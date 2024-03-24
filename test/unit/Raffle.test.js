const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const { developmetsChains, networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");
!developmetsChains.includes(network.name)
    ? describe.skip
    : describe("Raffle unit test", function () {
          let raffle, deployer, vrfCoordinatorV2Mock, interval, raffleEnteranceFee;
          let chainId = network.config.chainId;
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);

              raffle = await ethers.getContract("Raffle", deployer);
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
              raffleEnteranceFee = await raffle.getEntranceFee();
              interval = await raffle.getInterval();
          });

          describe("constructor", function () {
              it("initializes the raffle correctly", async function () {
                  //ideally we only should use only one assert per it.
                  const raffleState = await raffle.getRaffleState();

                  assert.equal(raffleState.toString(), "0");
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
              });
          });
          describe("enterRaffle", function () {
              it("reverts if don't pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__NotEnoughETHEntered",
                  );
              });
              it("records players as they enter", async function () {
                  await raffle.enterRaffle({
                      value: raffleEnteranceFee,
                  });
                  const playerFromContract = await raffle.getPlayer(0);
                  assert.equal(playerFromContract, deployer);
              });
              it("emits an event in enter", async function () {
                  await expect(raffle.enterRaffle({ value: raffleEnteranceFee })).to.emit(
                      raffle,
                      "RaffleEnter",
                  );
              });
              it("doesn't allow entrance when raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: raffleEnteranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  //calling checkUpkeep
                  await raffle.performUpkeep("0x");
                  await expect(
                      raffle.enterRaffle({ value: raffleEnteranceFee }),
                  ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen");
              });
          });
          describe("checkUpkeep", function () {
              it("returns false if people haven't sent any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = raffle.checkUpkeep.staticCall({ args: "0x" });
                  assert(!upkeepNeeded);
              });
              it("returns falls if raffle isn't open", async function () {
                  await raffle.enterRaffle({ value: raffleEnteranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  await raffle.performUpkeep("0x");
                  const raffleState = await raffle.getRaffleState();
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                  assert.equal(raffleState.toString(), "1");
                  assert.equal(upkeepNeeded, false);
              });

              it("returns false if enough time hasn't passed", async () => {
                  await raffle.enterRaffle({ value: raffleEnteranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) - 5]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = raffle.checkUpkeep.staticCall({ args: "0x" });

                  assert(!upkeepNeeded);
              });
              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await raffle.enterRaffle({ value: raffleEnteranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const raffleState = await raffle.getRaffleState();
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                  assert.equal(upkeepNeeded, true);
              });
          });
          describe("performUpkeep", function () {
              it("it can only run if checkupKeep is true", async function () {
                  await raffle.enterRaffle({ value: raffleEnteranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const tx = await raffle.performUpkeep("0x");
                  assert(tx);
              });
              it("reverts when checkUpkeep is false", async function () {
                  await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__UpKeepNotNeeded",
                  );
              });
              it("update the raffle state, emits an event and calls the vrf coordinator", async function () {
                  await raffle.enterRaffle({ value: raffleEnteranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const txResponse = await raffle.performUpkeep("0x");
                  const txReceipt = await txResponse.wait(1);
                  const requestId = txReceipt.logs[1].args.requestId;
                  const raffleState = await raffle.getRaffleState();
                  assert(Number(requestId) > 0);
                  //console.log(requestId);
                  assert(raffleState.toString() == "1");
              });
          });
          describe("fullfillRandomWords", function () {
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEnteranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
              });
              it("can only be called after performUpkeep", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.target),
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.target),
                  ).to.be.revertedWith("nonexistent request");
              });
              it("picks a winner, reset the lottery, and sends the money", async function () {
                  const additionalentrance = 3;
                  const startingAccountIndex = 1; // deployer =0
                  const accounts = await ethers.getSigners();
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalentrance;
                      i++
                  ) {
                      const accountsConnectedRaffle = raffle.connect(accounts[i]);
                      await accountsConnectedRaffle.enterRaffle({ value: raffleEnteranceFee });
                  }
                  const startingTimeStamp = await raffle.getLatestTimeStamp();

                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("WE are in business");
                          try {
                              const recentWinner = await raffle.getRecentWinner();
                              console.log(recentWinner);
                              //console.log(accounts[0].address);
                              //console.log(accounts[1].address);
                              //console.log(accounts[2].address);
                              //console.log(accounts[3].address);

                              const raffleState = await raffle.getRaffleState();
                              const endingTimeStamp = await raffle.getLatestTimeStamp();
                              const numPlayers = await raffle.getNumberOfPlayers();
                              winnerEndingBalance = await ethers.provider.getBalance(accounts[1]);
                              assert.equal(numPlayers.toString(), "0");
                              assert.equal(raffleState.toString(), "0");
                              assert(endingTimeStamp > startingTimeStamp);
                              assert.equal(
                                  winnerEndingBalance,
                                  (
                                      winnerStartingBalance +
                                      raffleEnteranceFee * BigInt(additionalentrance) +
                                      raffleEnteranceFee
                                  ).toString(),
                              );
                          } catch (e) {
                              reject(e);
                          }
                          resolve();
                      });

                      const tx = await raffle.performUpkeep("0x");
                      const txReceipt = await tx.wait(1);
                      console.log("Here");
                      const winnerStartingBalance = await ethers.provider.getBalance(accounts[1]);
                      //console.log(winnerStartingBalance);
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.logs[1].args.requestId,
                          raffle.target,
                      );
                      console.log("Fullfilled");
                  });
              });
          });
      });
