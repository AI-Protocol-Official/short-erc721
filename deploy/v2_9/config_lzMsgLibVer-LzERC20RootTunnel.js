// run: npx hardhat deploy --network goerli --tags config_lzMsgLibVer-LzERC20RootTunnel

// script is built for hardhat-deploy plugin:
// A Hardhat Plugin For Replicable Deployments And Easy Testing
// https://www.npmjs.com/package/hardhat-deploy

// BN utils
const {
	toBN,
	isBN,
	print_amt,
} = require("../../scripts/include/bn_utils");

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

	// config LZ Endpoint: LzERC20RootTunnel
	{
		// get the deployment details
		const tunnel_v1_deployment = await deployments.get("LzERC20RootTunnelV1");
		const tunnel_v1_contract = new web3.eth.Contract(tunnel_v1_deployment.abi, tunnel_v1_deployment.address);

		// get proxy deployment details
		const tunnel_proxy_deployment = await deployments.get("LzERC20RootTunnel_Proxy");
		const tunnel_proxy_contract = new web3.eth.Contract(tunnel_v1_deployment.abi, tunnel_proxy_deployment.address);

		// print proxy deployment details
		await print_contract_details(A0, tunnel_v1_deployment.abi, tunnel_proxy_deployment.address);

		// get root tunnel address
		const {address: tunnel_address} = tunnel_proxy_deployment;
		console.log("LzERC20RootTunnel_Proxy (UA) address: %o", tunnel_address);

		// get the LZ Endpoint address
		const {lzEndpoint: lz_endpoint_address} = await getNamedAccounts();
		// LZ Endpoint ABI
		const {abi: lz_endpoint_abi} = await deployments.getArtifact("ILayerZeroEndpointExtension");
		// connect to LZ Endpoint
		const lzEndpoint = new web3.eth.Contract(lz_endpoint_abi, lz_endpoint_address);

		// read the configuration
		const send_version = await lzEndpoint.methods.getSendVersion(tunnel_address).call(); // the version to set if not matches
		const receive_version = await lzEndpoint.methods.getReceiveVersion(tunnel_address).call(); // the version to set if not matches
		const send_lib_address = await lzEndpoint.methods.getSendLibraryAddress(tunnel_address).call();
		const receive_lib_address = await lzEndpoint.methods.getReceiveLibraryAddress(tunnel_address).call();
		const lib_conf = await lzEndpoint.methods.uaConfigLookup(tunnel_address).call();
		const ua_send_version = lib_conf.sendVersion;
		const ua_receive_version = lib_conf.receiveVersion;
		const ua_send_lib_address = lib_conf.sendLibrary;
		const ua_receive_lib_address = lib_conf.receiveLibraryAddress;

		console.log("successfully connected to LZ Endpoint at %o", lz_endpoint_address);
		console.table([
			{"key": "UA-stored Send Version", "value": ua_send_version},
			{"key": "Effective Send Version", "value": send_version},
			{"key": "UA-stored Receive Version", "value": ua_receive_version},
			{"key": "Effective Receive Version", "value": receive_version},
			{"key": "UA-stored Send Lib Address", "value": ua_send_lib_address},
			{"key": "Effective Send Lib Address", "value": send_lib_address},
			{"key": "UA-stored Receive Lib Address", "value": ua_receive_lib_address},
			{"key": "Effective Receive Lib Address", "value": receive_lib_address},
		]);

		// update send version if required
		if(ua_send_version !== send_version) {
			// prepare the setSendVersion call bytes for the contract call
			const call_data = tunnel_proxy_contract.methods.setSendVersion(send_version).encodeABI();

			// execute the prepared transaction
			const receipt = await deployments.rawTx({
				from: A0,
				to: tunnel_address,
				data: call_data, // setSendVersion(send_version)
			});
			console.log("LzERC20RootTunnel_Proxy.setSendVersion(%o): %o", send_version, receipt.transactionHash);
		}

		// update receive version if required
		if(receive_version !== ua_receive_version) {
			// prepare the setReceiveVersion call bytes for the contract call
			const call_data = tunnel_proxy_contract.methods.setReceiveVersion(receive_version).encodeABI();

			// execute the prepared transaction
			const receipt = await deployments.rawTx({
				from: A0,
				to: tunnel_address,
				data: call_data, // setReceiveVersion(receive_version)
			});
			console.log("LzERC20RootTunnel_Proxy.setReceiveVersion(%o): %o", receive_version, receipt.transactionHash);
		}
	}
};

// Tags represent what the deployment script acts on. In general, it will be a single string value,
// the name of the contract it deploys or modifies.
// Then if another deploy script has such tag as a dependency, then when the latter deploy script has a specific tag
// and that tag is requested, the dependency will be executed first.
// https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies
module.exports.tags = ["config_lzMsgLibVer-LzERC20RootTunnel", "v2_9", "config", "L1", "l1"];
module.exports.dependencies = ["LzERC20RootTunnel_Proxy", "setup-LzERC20RootTunnel"];
