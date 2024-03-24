const { network, ethers } = require("hardhat");
const { developmetsChains } = require("../helper-hardhat-config");

const BASE_FEE = ethers.parseEther("0.25"); //0.25 LINK for chainlink
const GAS_PRICE_LINK = 1e9; // gas price perlink

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const args = [BASE_FEE, GAS_PRICE_LINK];

    if (developmetsChains.includes(network.name)) {
        log("local network detected deploying mocks");

        // deploying mocks
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args,
        });
        log("Mock Deployed");
        log("----------------------------------------");
    }
};

module.exports.tags = ["all", "mocks"];
