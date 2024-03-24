const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const { developmetsChains, networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");
developmetsChains.includes(network.name)
    ? describe.skip
    : describe("Raffle staging test", function () {
          let raffle, deployer, raffleEnteranceFee;

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              raffle = await ethers.getContract("Raffle", deployer);
              raffleEnteranceFee = await raffle.getEntranceFee();
          });
          describe("fullfillRandomWords", function () {
              it("It works with live chainlink keepersand chainlink VRF, and we get random winner", async function () {
                  const startingTimeStamp = await raffle.getLatestTimeStamp();
                  const accounts = await ethers.getSigners();
                  console.log("At the top of Resolve");
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                  console.log(upkeepNeeded);
                  await new Promise(async (resolve, reject) => {
                      //setting up the listner

                      raffle.once("WinnerPicked", async () => {
                          console.log("winnerpicked event fired");
                          try {
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const winnerEndingBalance = await ethers.provider.getBalance(
                                  accounts[0],
                              );
                              const endingTimeStamp = await raffle.getLatestTimeStamp();

                              await expect(raffle.getPlayer(0)).to.be.reverted;
                              assert.equal(recentWinner, accounts[0].address);
                              assert.equal(raffleState.toString(), "0");
                              /*assert.equal(
                                  winnerEndingBalance.toString(),
                                  (winnerStartingBalance + raffleEnteranceFee).toString(),
                              );*/
                              assert(endingTimeStamp > startingTimeStamp);
                          } catch (error) {
                              console.log(error);
                              reject(error);
                          }
                          resolve();
                      });
                      //entering raffle
                      await raffle.enterRaffle({ value: raffleEnteranceFee });
                      const winnerStartingBalance = await ethers.provider.getBalance(accounts[0]);
                      console.log("Entered the raffle with money sent");
                  });
              });
          });
      });
