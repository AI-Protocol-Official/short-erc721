// run: npx hardhat deploy --network goerli --tags setup-LzERC20RootTunnel

// script is built for hardhat-deploy plugin:
// A Hardhat Plugin For Replicable Deployments And Easy Testing
// https://www.npmjs.com/package/hardhat-deploy

// BN utils
const {
	toBN,
	print_amt,
} = require("../../scripts/include/bn_utils");

// Zeppelin helper constants
const {
	ZERO_ADDRESS,
	ZERO_BYTES32,
	MAX_UINT256,
} = require("@openzeppelin/test-helpers/src/constants");

// deployment utils (contract state printers)
const {
	print_contract_details,
} = require("../../scripts/deployment_utils");

// to be picked up and executed by hardhat-deploy plugin
module.exports = async function({deployments, getChainId, getNamedAccounts, getUnnamedAccounts}) {
	// print some useful info on the account we're using for the deployment
	const chainId = await getChainId();
	const accounts = await web3.eth.getAccounts();
	// do not use the default account for tests
	const A0 = network.name === "hardhat"? accounts[1]: accounts[0];
	const nonce = await web3.eth.getTransactionCount(A0);
	const balance = await web3.eth.getBalance(A0);

	// print initial debug information
	console.log("script: %o", require("path").basename(__filename));
	console.log("network %o %o", chainId, network.name);
	console.log("accounts: %o, service account %o, nonce: %o, balance: %o ETH", accounts.length, A0, nonce, print_amt(balance));

	// root tunnel is available only in L1
	assert(network.name === "mainnet" || network.name === "goerli", "unsupported network: " + network.name);

	// setup LzERC20RootTunnel
	{
		// determine name of the L2 network based on the name of L1 network
		const l2_net = network.name === "mainnet"? "binance": "binance_testnet";
		const l2_chain_id = network.name === "mainnet"? 102: 10102; // polygon: 109: 10109

		// get impl deployment details
		const v1_deployment = await deployments.get("LzERC20RootTunnelV1");
		const v1_contract = new web3.eth.Contract(v1_deployment.abi, v1_deployment.address);

		// print v1 deployment details
		await print_contract_details(A0, v1_deployment.abi, v1_deployment.address);

		// get proxy deployment details
		const proxy_deployment = await deployments.get("LzERC20RootTunnel_Proxy");
		const proxy_contract = new web3.eth.Contract(v1_deployment.abi, proxy_deployment.address);

		// print proxy deployment details
		await print_contract_details(A0, v1_deployment.abi, proxy_deployment.address);

		try {
			// read LzERC20ChildTunnel address from the deployment data
			const {address: child_tunnel} = require(`../../deployments/${l2_net}/LzERC20ChildTunnel_Proxy.json`);

			// check if childTunnel is already set and set it if required
			const child_tunnel_set = await proxy_contract.methods.childTunnelAddress().call();
			if(!child_tunnel_set || child_tunnel_set === ZERO_ADDRESS) {
				// prepare the setChildTunnel call bytes for the contract call
				const call_data = proxy_contract.methods.setChildTunnel(l2_chain_id, child_tunnel).encodeABI();

				// execute raw transaction
				const receipt = await deployments.rawTx({
					from: A0,
					to: proxy_deployment.address,
					data: call_data, // setChildTunnel(l2_chain_id, child_tunnel)
				});
				console.log("LzERC20RootTunnel.setChildTunnel(%o, %o): %o", l2_chain_id, child_tunnel, receipt.transactionHash);
			}
			else {
				console.log("LzERC20RootTunnel.childTunnel* already set to %o", child_tunnel_set);
				assert(child_tunnel_set === child_tunnel, "unexpected LzERC20RootTunnel.childTunnel*");
			}
		}
		catch(e) {
			if(e.code !== "MODULE_NOT_FOUND") {
				throw e;
			}
			console.log();
			console.log("╔══════════════════════════════════════════════════════════════════════════════════════════════════╗");
			console.log("║ NOTE: LzERC20ChildTunnel is not yet deployed and childTunnel cannot be set on LzERC20RootTunnel  ║");
			console.log("║ Please rerun the script again once the LzERC20ChildTunnel is deployed                            ║");
			console.log("╚══════════════════════════════════════════════════════════════════════════════════════════════════╝");
			console.log();
		}
	}
};

// Tags represent what the deployment script acts on. In general, it will be a single string value,
// the name of the contract it deploys or modifies.
// Then if another deploy script has such tag as a dependency, then when the latter deploy script has a specific tag
// and that tag is requested, the dependency will be executed first.
// https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies
module.exports.tags = ["setup-LzERC20RootTunnel", "v2_9", "setup", "L1", "l1"];
module.exports.dependencies = ["LzERC20RootTunnel_Proxy"];
