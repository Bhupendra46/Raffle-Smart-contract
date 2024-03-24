const { run } = require("hardhat");

async function verify(contractAddress, args) {
    console.log("plz wait... for verification");
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        });
    } catch (e) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already Veryfied");
        } else {
            console.log(e);
        }
    }
}

module.exports = { verify };
