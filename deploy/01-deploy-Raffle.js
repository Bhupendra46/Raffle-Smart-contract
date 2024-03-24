const { network, ethers } = require("hardhat");
const { developmetsChains, networkConfig } = require("../helper-hardhat-config");
const { TransactionReceipt } = require("ethers");
const { verify } = require("../utils/verify");
const VRF_SUB_FUND_AMOUNT = ethers.parseEther("1");

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    log(VRF_SUB_FUND_AMOUNT);
    chainId = network.config.chainId;
    let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock;

    if (developmetsChains.includes(network.name)) {
        vrfCoordinatorV2Address = (await deployments.get("VRFCoordinatorV2Mock")).address;
        vrfCoordinatorV2Mock = await ethers.getContractAt(
            "VRFCoordinatorV2Mock",
            vrfCoordinatorV2Address,
        );

        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();

        const transactionReceipt = await transactionResponse.wait(1);
        //console.log(transactionReceipt.logs);
        // getting subscription Id from event

        //log(transactionReceipt);
        subscriptionId = await transactionReceipt.logs[0].args.subId;
        //log("ID created ----", subscriptionId);
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
        //log("Funded---");
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }

    const entranceFee = networkConfig[chainId]["entranceFee"];
    const gasLane = networkConfig[chainId]["gasLane"];
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    const interval = networkConfig[chainId]["interval"];
    const args = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ];
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    });

    // Adding consumer ------ for error correction
    if (developmetsChains.includes(network.name)) {
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address);

        log("Consumer is added");
    }
    //-----------------------------------------
    if (!developmetsChains.includes(network.name && process.env.ETHERSCAN_API_KEY)) {
        log("Verifying .....");
        await verify(raffle.address, args);
    }
    log("-----------------------------------------------------");
    log("contract deployed");
};

module.exports.tags = ["all", "raffle"];
