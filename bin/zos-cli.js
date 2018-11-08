#!/usr/bin/env node
var Client = require('../lib/zosAccessor');

var argv = process.argv.slice(2),
    connectOptions = {},
    operations = [];
for (var i=0; i < argv.length; i+=1) {
    var arg = argv[i];
    if (arg.startsWith('--')) {
        connectOptions[arg.substr('--'.length)] = argv[i+1];
        i += 1;
    } else {
        operations.push(arg);
    }
}

if (Object.keys(connectOptions).length === 0) {
    console.error('Usage: zos [connect-options] method ...method-arguments');
    console.error('\nconnect-options are arguments passed to the "connect" method, each should start with "--".');
    console.error('method can be any one that "zos-node-accessor" supports, see them here: https://github.com/IBM/zos-node-accessor#usage.');
    console.error("\neg. zos --host MYSERVER --user ABC --password SECRET submitJCL /path/to/local.JCL");
    process.exit(0);
}

new Client().connect(connectOptions).then(function (connection) {
    if (operations.length) {
        return connection[operations[0]].apply(connection, operations.slice(1));
    }
    return 'Connect successfully';
}).then(function(resp) {
    resp = resp || 'OK';
    if (typeof resp === 'string') {
        console.log(resp);
    } else if (Buffer.isBuffer(resp)) {
        console.log(resp.toString());
    } else {
        console.log(JSON.stringify(resp, null, 2));
    }
    process.exit(0);
}).catch(function(err) {
    console.error(err.message);
    process.exit(1);
});