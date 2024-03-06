// run: npx hardhat deploy --network binance_testnet --tags setup-LzERC20ChildTunnel

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

	// child tunnel is available only in L2
	assert(network.name === "binance" || network.name === "binance_testnet", "unsupported network: " + network.name);

	// setup LzERC20ChildTunnel
	{
		// determine name of the L1 network based on the name of L2 network
		const l1_net = network.name === "binance"? "mainnet": "goerli";
		const l1_chain_id = network.name === "binance"? 101: 10121;

		// get impl deployment details
		const v1_deployment = await deployments.get("LzERC20ChildTunnelV1");
		const v1_contract = new web3.eth.Contract(v1_deployment.abi, v1_deployment.address);

		// print v1 deployment details
		await print_contract_details(A0, v1_deployment.abi, v1_deployment.address);

		// get proxy deployment details
		const proxy_deployment = await deployments.get("LzERC20ChildTunnel_Proxy");
		const proxy_contract = new web3.eth.Contract(v1_deployment.abi, proxy_deployment.address);

		// print proxy deployment details
		await print_contract_details(A0, v1_deployment.abi, proxy_deployment.address);

		try {
			// read LzERC20RootTunnel address from the deployment data
			const {address: root_tunnel} = require(`../../deployments/${l1_net}/LzERC20RootTunnel_Proxy.json`);

			// check if rootTunnel is already set and set it if required
			const root_tunnel_set = await proxy_contract.methods.rootTunnelAddress().call();
			if(!root_tunnel_set || root_tunnel_set === ZERO_ADDRESS) {
				// prepare the setRootTunnel call bytes for the contract call
				const call_data = proxy_contract.methods.setRootTunnel(l1_chain_id, root_tunnel).encodeABI();

				// execute raw transaction
				const receipt = await deployments.rawTx({
					from: A0,
					to: proxy_deployment.address,
					data: call_data, // setRootTunnel(l1_chain_id, root_tunnel)
				});
				console.log("LzERC20ChildTunnel.setRootTunnel(%o, %o): %o", l1_chain_id, root_tunnel, receipt.transactionHash);
			}
			else {
				console.log("LzERC20ChildTunnel.rootTunnel* already set to %o", root_tunnel_set);
				assert(root_tunnel_set === root_tunnel, "unexpected LzERC20ChildTunnel.rootTunnel*");
			}
		}
		catch(e) {
			if(e.code !== "MODULE_NOT_FOUND") {
				throw e;
			}
			console.log();
			console.log("╔══════════════════════════════════════════════════════════════════════════════════════════════════╗");
			console.log("║ NOTE: LzERC20RootTunnel is not yet deployed and rootTunnel cannot be set on LzERC20ChildTunnel   ║");
			console.log("║ Please rerun the script again once the LzERC20RootTunnel is deployed                             ║");
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
module.exports.tags = ["setup-LzERC20ChildTunnel", "v2_9", "setup", "L2", "l2"];
module.exports.dependencies = ["LzERC20ChildTunnel_Proxy"];
