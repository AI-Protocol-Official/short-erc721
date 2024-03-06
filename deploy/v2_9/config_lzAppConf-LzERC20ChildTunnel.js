// run: npx hardhat deploy --network binance_testnet --tags config_lzAppConf-LzERC20ChildTunnel

// script is built for hardhat-deploy plugin:
// A Hardhat Plugin For Replicable Deployments And Easy Testing
// https://www.npmjs.com/package/hardhat-deploy

// BN utils
const {
	toBN,
	isBN,
	print_amt,
} = require("../../scripts/include/bn_utils");

// LZ constants
const {
	ua_config_types,
	target_network,
	chain_ids,
} = require("../../scripts/lz_config");

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

	// config LZ Endpoint: LzERC20ChildTunnel
	{
		// get the deployment details
		const tunnel_v1_deployment = await deployments.get("LzERC20ChildTunnelV1");
		const tunnel_v1_contract = new web3.eth.Contract(tunnel_v1_deployment.abi, tunnel_v1_deployment.address);

		// get proxy deployment details
		const tunnel_proxy_deployment = await deployments.get("LzERC20ChildTunnel_Proxy");
		const tunnel_proxy_contract = new web3.eth.Contract(tunnel_v1_deployment.abi, tunnel_proxy_deployment.address);

		// print proxy deployment details
		await print_contract_details(A0, tunnel_v1_deployment.abi, tunnel_proxy_deployment.address);

		// get tunnel address
		const {address: tunnel_address} = tunnel_proxy_deployment;
		console.log("LzERC20ChildTunnel_Proxy (UA) address: %o", tunnel_address);

		// get the LZ Endpoint address
		const {lzEndpoint: lz_endpoint_address} = await getNamedAccounts();
		// LZ Endpoint ABI
		const {abi: lz_endpoint_abi} = await deployments.getArtifact("ILayerZeroEndpointExtension");
		// connect to LZ Endpoint
		const lzEndpoint = new web3.eth.Contract(lz_endpoint_abi, lz_endpoint_address);

		// connect to LZ Endpoint and Messaging Libraries
		const lz_lib_version = parseInt(await lzEndpoint.methods.getSendVersion(tunnel_address).call());
		assert(
			lz_lib_version === parseInt(await lzEndpoint.methods.getReceiveVersion(tunnel_address).call()),
			"send/receive lib version mismatch"
		);
		const send_lib_address = await lzEndpoint.methods.getSendLibraryAddress(tunnel_address).call();
		const receive_lib_address = await lzEndpoint.methods.getReceiveLibraryAddress(tunnel_address).call();
		console.log("successfully connected to LZ Endpoint at %o", lz_endpoint_address);
		const {abi: lz_lib_abi} = await deployments.getArtifact("ILayerZeroMessagingLibraryExtension");
		console.log("LZ Send Messaging Lib address: %o", send_lib_address);
		console.log("LZ Receive Messaging Lib address: %o", receive_lib_address);

		// determine chain ID of the network to configure based on the network name
		const target_network_name = target_network[network.name];
		const target_chain_id = chain_ids[target_network_name];
		console.log("target network %o: %o", target_network_name, target_chain_id);

		const TWO_64 = toBN(2).pow(toBN(64));
		function decodeConfigValue(conf_value) {
			const isAbiEncoded = conf_value.indexOf("0x") === 0 && conf_value.length === 66;
			const bn_value = isAbiEncoded? toBN(web3.eth.abi.decodeParameter("uint256", conf_value)): toBN(conf_value);
			if(bn_value.lt(TWO_64)) {
				return bn_value.toNumber();
			}
			return isAbiEncoded? web3.eth.abi.decodeParameter("address", conf_value): conf_value;
		}
		function encodeConfigValue(conf_value) {
			const bn_value = toBN(conf_value);
			if(bn_value.lt(TWO_64)) {
				return web3.eth.abi.encodeParameter("uint256", conf_value);
			}
			return web3.eth.abi.encodeParameter("address", conf_value);
		}
		async function getConfig(conf_type) {
			const conf_type_value = ua_config_types[conf_type];
			return await lzEndpoint.methods.getConfig(lz_lib_version, target_chain_id, tunnel_address, conf_type_value).call();
		}
		async function setConfig(conf_type, conf_value) {
			const conf_type_value = ua_config_types[conf_type];
			const encoded_conf_value = encodeConfigValue(conf_value);

			// prepare the setConfig call bytes for the contract call
			const call_data = tunnel_proxy_contract.methods.setConfig(
				lz_lib_version,				// uint16 _version
				target_chain_id,			// uint16 _chainId
				conf_type_value,			// uint _configType
				encoded_conf_value,		// bytes _config
			).encodeABI();

			// execute the prepared transaction
			const receipt = await deployments.rawTx({
				from: A0,
				to: tunnel_address,
				data: call_data, // setConfig(uint16 _version, uint16 _chainId, uint _configType, bytes calldata _config)
			});
			console.log(
				"LzERC20ChildTunnel_Proxy.setConfig(%o, %o, %o, %o): %o",
				lz_lib_version,				// uint16 _version
				target_network_name,	// uint16 _chainId
				conf_type,						// uint _configType
				conf_value,						// bytes _config
				receipt.transactionHash,
			);
			return receipt;
		}

		async function configLzLib(lib_address, lib_name = "LZ Messaging Lib") {
			const lzMsgLib = new web3.eth.Contract(lz_lib_abi, lib_address);
			const ua_config = await lzMsgLib.methods.appConfig(tunnel_address, target_chain_id).call();

			const config = {};
			const table_data = [];
			for(const config_type in ua_config_types) {
				if(ua_config_types.hasOwnProperty(config_type)) {
					const config_type_value = ua_config_types[config_type];
					if(typeof config_type_value === "number") {
						const ua_config_value = decodeConfigValue(ua_config[config_type]);
						const config_value = decodeConfigValue(await getConfig(config_type));
						config[config_type] = config_value;
						table_data.push(...[
							{"key": `UA-stored ${config_type}`, "value": ua_config_value},
							{"key": `Effective ${config_type}`, "value": config_value},
						]);
					}
				}
			}
			console.log(lib_name + " %o config loaded", lib_address);
			console.table(table_data);
			for(const config_type in ua_config_types) {
				if(ua_config_types.hasOwnProperty(config_type)) {
					const config_type_value = ua_config_types[config_type];
					if(typeof config_type_value === "number") {
						const ua_config_value = decodeConfigValue(ua_config[config_type]);
						const config_value = config[config_type];

						if(ua_config_value !== config_value) {
							await setConfig(config_type, config_value);
						}
					}
				}
			}
		}

		// configure LZ Send Library
		await configLzLib(send_lib_address, "LZ Send Lib");
		// configure LZ Send Library
		await configLzLib(receive_lib_address, "LZ Receive Lib");
	}
};

// Tags represent what the deployment script acts on. In general, it will be a single string value,
// the name of the contract it deploys or modifies.
// Then if another deploy script has such tag as a dependency, then when the latter deploy script has a specific tag
// and that tag is requested, the dependency will be executed first.
// https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies
module.exports.tags = ["config_lzAppConf-LzERC20ChildTunnel", "v2_9", "config", "L2", "l2"];
module.exports.dependencies = ["LzERC20ChildTunnel_Proxy", "config_lzMsgLibVer-LzERC20ChildTunnel"];
