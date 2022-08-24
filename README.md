# z/OS Node Accessor

[![Build Status](https://travis-ci.org/IBM/zos-node-accessor.svg)](https://travis-ci.org/IBM/zos-node-accessor)
[![Module LTS Adopted'](https://img.shields.io/badge/Module%20LTS-Adopted-brightgreen.svg?style=flat)](http://github.com/CloudNativeJS/ModuleLTS)
[![IBM Support](https://img.shields.io/badge/Support-IBM%20Runtimes-brightgreen.svg?style=flat)](http://ibm.biz/node-support)

A Node module to help Node.JS developers interacting with z/OS easily, taking 
advantage of z/OS FTP service. It's recommended to be deployed on z/OS, 
to avoid transferring user account/password in clear-text over network. IBM
SDK for Node.js - z/OS is available at 
[https://developer.ibm.com/mainframe/products/ibm-sdk-for-node-js-z-os/](https://developer.ibm.com/mainframe/products/ibm-sdk-for-node-js-z-os/).

For a [Zowe CLI](https://github.com/zowe/zowe-cli) plugin based on this functionality, see https://github.com/zowe/zowe-cli-ftp-plugin

## Installation & Test

```bash
npm install zos-node-accessor   # Put latest version in your package.json
npm test                        # You'll need the dev dependencies to launch tests
```

## Features

* List MVS dataset or USS files
* Download/Upload MVS dataset or USS files
* Submit JCL and query its status to track its completion
* Access SYSOUT dataset
* Some simple JCL, like initiating HRECALL, allocating dataset, and so on.

## Usage

This accessor leverages z/OS FTP server to interact with z/OS, it requires `JESINTERFACELevel` set to `2`

* [Connection](#connection)
* [MVS dataset or USS files](#mvs-dataset-or-uss-files)
  * [Allocate](#allocate)
  * [Make directory](#make-directory)
  * [List](#list)
  * [Upload](#upload-mvs-dataset-or-uss-file)
  * [Read](#read-mvs-dataset-or-uss-file)
  * [Delete](#delete)
  * [Rename](#rename)
* [JES jobs](#jes-jobs)
  * [List jobs](#list-jobs)
  * [Submit JCL](#submit-jcl)
      * [Allocate dataset](#allocate-dataset)
      * [Copy dataset](#copy-dataset)
      * [Initiate HRECALL](#initiate-hrecall)
  * [Query job status](#query-job)
  * [Get job status](#get-job-status)
  * [Get JES spool files](#get-jes-spool-files)
  * [Delete job](#delete-job)
* [Others](#others)
  * [Retrieve Server Status](#retrieve-server-status)
  * [Submit SITE commands](#submit-site-commands)

### Connection

Before connecting to a z/OS server, you need to initialize an instance using the constructor `new zosAccessor()`, then call the `connect(config)` method, where:

##### Parameter

* config - _object_ - Configuration passed to the underlying ftp library, valid properties:
  * user - _string_ - Username for authentication on z/OS. **Default:** 'anonymous'
  * password - _string_ - Password for authentication on z/OS. **Default:** 'anonymous@'
  * host - _string_ - The hostname or IP address of the z/OS server to connect to. **Default:** 'localhost'
  * port - _integer_ - The port of the z/OS FTP server. **Default:** 21
  * secure - _mixed_ - Set to true for both control and data connection encryption, 'control' for control connection encryption only, or 'implicit' for implicitly encrypted control connection (this mode is deprecated in modern times, but usually uses port 990) **Default:** false
  * secureOptions - _object_ - Additional options to be passed to `tls.connect()`. **Default:** (none)
  * connTimeout - _integer_ - How long (in milliseconds) to wait for the control connection to be established. **Default:** 10000
  * pasvTimeout - _integer_ - How long (in milliseconds) to wait for a PASV data connection to be established. **Default:** 10000
  * keepalive - _integer_ - How often (in milliseconds) to send a 'dummy' (NOOP) command to keep the connection alive. **Default:** 10000

##### Return

A promise that resolves itself (the connection to z/OS), and rejects on any error.

##### Example

```js
var Client = require('zos-node-accessor');

var c = new Client();
// connect to localhost:21 as hansome using password
c.connect({user: 'myname', password:'mypassword'})
  .then(function(connection) {
    // here connection equals to outer c
  })
  .catch(function(err) {
    // handle error
  });
```

### MVS dataset or USS files

#### Allocate

`allocateDataset(datasetName, allocateParams)` - Allocate sequential or partition (with the DCB attribute "PDSTYPE=PDS") dataset.

##### Parameter

* datasetName - _string_ -  Dataset name to allocate.
* allocateParams - _object | string_ -  A string of space separated DCB attributes or an object of DCB attribute key-value pairs, eg. "LRECL=80 RECFM=VB" or {"LRECL": 80, "RECFM": "VB"}. These attributes are transferred as FTP `site` sub commands. The tested attributes includes BLKsize/BLOCKSIze, BLocks, CYlinders, Directory, LRecl, PDSTYPE, PRImary, RECfm, SECondary, and TRacks.

Note: `DSORG=PO` was defined by zos-node-accessor, not `site` sub command. It's deprecated by `site` sub command, `PDSTYPE=PDS` or `PDSTYPE=PDSE`.

The `site` sub commands can be found at https://www.ibm.com/docs/en/zos/2.3.0?topic=subcommands-site-subcommandsend-site-specific-information-host.

Option Key | Description
---- | ---
BLKsize/BLOCKSIze=size	|	block size
BLocks | space allocations in blocks
CYlinders | space allocations in cylinders
DATAClass=data_class	|	data class
DCBDSN=data_set_name	|	the data set to be used as a model for allocation of new data sets
Directory=size	|	directory blocks
DSNTYPE=SYSTEM or BASIC or LARGE	|	data set name type
EATTR=SYSTEM or NO or OPT	|	extended attributes
LRecl=length	|	logical record length
MGmtclass=mgmtclass	|	management class
PDSTYPE=PDS or PDSE	|	PDS type
PRImary=amount	|	primary space
RECfm=format	|	record format
RETpd=days	|	retention period
SECondary=amount	|	secondary space
STOrclass=storage_class	|	storage class
TRacks | space allocations in tracks
UCOUN=unit_count	or P|	how many devices to allocate concurrently for this allocation request
Unit=unit_type	|	unit type for allocation of new data sets
VCOUNT=volume_count	|	number of tape data set volumes that an allocated data set can span
VOLume=volume_serial or (volume_serial_list)	|	volume serial number

##### Return

A promise that resolves on success, rejects on error.

##### Example

```js
connection.allocateDataset('ABC.DEF', {'LRECL': 80, 'RECFM': 'FB', 'BLKSIZE': 320})
  .then(function() {
    console.log('Success');
  })
  .catch(function(err) {
    // handle error
  });
```

```js
connection.allocateDataset('ABC.PDS', {'LRECL': 80, 'RECFM': 'FB', 'BLKSIZE': 320, 'PDSTYPE': 'PDS', 'DIRECTORY': 20})
  .then(function() {
    console.log('Success');
  })
  .catch(function(err) {
    // handle error
  });
```

#### Make directory

`makeDirectory(directoryName)` - Make USS directory with the given directory name.

##### Parameter

* datasetName - _string_ -  Dataset name to allocate.

##### Return

A promise that resolves on success, rejects on error.

##### Example

```js
connection.makeDirectory('/u/user/my_directory'})
  .then(function() {
    console.log('Success');
  })
  .catch(function(err) {
    // handle error
  });
```

#### List

`listDataset(dsnOrDir)` - List MVS datasets or USS files

##### Parameter

* dsnOrDir - _string_ -  Specify a full qualified dataset name, supporting wildcards (* or ?), PDS members (HLQ.JCL(*)) and USS directory.

##### Return

A promise that resolves a list of 

* dataset entries. Each entry has the property of `Volume`, `Unit`, `Referred`, `Ext`, `Used`, `Recfm`, `Lrecl`, `BlkSz`, `Dsorg`, and `Dsname`.

* USS file entries. Each entry has the property of `name`, `size`, `owner`, `group`, and `permissions`. 

##### Example

```js
connection.listDataset('HQL.*.JCL')
  .then(function(list) {
    for(var i=0; i<list.length; ++i) {
      var entry = list[i];
      console.log('name:', entry['Dsname'], 'dsorg', entry['Dsorg']);
    }
  })
  .catch(function(err) {
    // handle error
  });
```

```js
connection.listDataset('/u/user1/')
  .then(function(list) {
    for(var i=0; i<list.length; ++i) {
      var entry = list[i];
      console.log(entry.name, entry.owner, entry.group, entry.size);
    }
  })
  .catch(function(err) {
    // handle error
  });
```

#### Upload MVS dataset or USS file

`uploadDataset(input, destDataset, dataType, allocateParams)` - Upload a local file to MVS dataset or USS file.

##### Parameter

* input - _any_ -  A [ReadableStream](https://nodejs.org/api/stream.html#stream_readable_streams), a [Buffer](https://nodejs.org/api/buffer.html), or a path to a local file that needs uploading.
* destDataset - _string_ -  Dataset name to used to store the uploaded file, if it starts with `/` this file will be uploaded to USS.
* dataType - _string (default: ascii)_ -  Transfer data type, it should be 'ascii' or 'binary', **when transfering 'ascii' files, the end-of-line sequence of input should always be `\r\n`**, otherwise the transfered file will get truncated.
* allocateParams - _object | string_ -  A string of space separated DCB attributes or an object of DCB attribute key-value pairs, eg. "LRECL=80 RECFM=VB" or {"LRECL": 80, "RECFM": "VB"}. The tested attributes: BLKsize/BLOCKSize, LRecl, RECfm, PRImary, SECondary, TRacks.
Extra parameters need to add siteParams can also be specified there , for example, 'sbd=(IBM-1047,ISO8859-1)' for encoding setting.

##### Return

A promise that resolves on success, rejects on error.

##### Example

```js
var fs = require('fs');
var input = fs.readFileSync('/etc/hosts', 'utf8').replace(/\r?\n/g, '\r\n');
connection.uploadDataset(input, 'hosts')
  .then(function() {
    console.log('Success');
  })
  .catch(function(err) {
    // handle error
  });
```

```js
var fs = require('fs');
var input = fs.readFileSync('/etc/hosts', 'utf8').replace(/\r?\n/g, '\r\n');
connection.uploadDataset(input, 'HLQ.HOSTS', "LRECL=80 RECFM=FB")
  .then(function() {
    console.log('Success');
  })
  .catch(function(err) {
    // handle error
  });
```

#### Read MVS dataset or USS file

`getDataset(dsn, dataType, stream)` - Get the contents of the MVS dataset or USS file.

##### Parameter

* dsn - _string_ -  Specify a full qualified dataset name, or USS file name. It **CAN NOT** contain any wildcard (*).
* dataType - _string (default: 'ascii')_ -  Transfer data type, accepts three options `binary`,  `ascii`, `ascii_strip_eol`, `ascii_rdw` or `binary_rdw`. When downloading an ascii dataset, dataType should be either `ascii` or `ascii_strip_eol` so that the FTP server converts `EBCDIC` characters to  `ASCII`, `ascii_strip_eol` tells FTP server not the append a CLRF to the end of each record. The `ascii_rdw` or `binary_rdw`
can be used to download variable-length dataset like V, VB, VBS, etc. The 4-byte RDW (Record Descriptor Word) is inserted at the beginning
of each record.
* stream - _boolean (default: false)_ -  `true` if you want to obtain a [ReadableStream](https://nodejs.org/api/stream.html#stream_readable_streams) of the data set content, or `false` to read a full dataset into memory (in Buffer).
* params - _string_ - Add extra parameters to siteParams, for example, 'sbd=(IBM-1047,ISO8859-1)' for encoding setting.

##### Return

A promise that resolves content of the dataset or file in either `Buffer` or `ReadableStream`.

##### Example

```js
connection.getDataset('HQL.AA.JCL', 'ascii')
  .then(function(jclBuffer) {
    console.log('JCL is:');
    console.log(jclBuffer.toString());
  })
  .catch(function(err) {
    // handle error
  });
```

#### Delete

`delete(dsn)` - Delete a dataset or USS file.

##### Parameter

* dsn - _string_ -  Specify a full qualified dataset name to delete, it **CAN NOT** contain a wildcard (*).

##### Return

A promise that resolves on success, rejects on error.

##### Example

```js
connection.deleteDataset('HQL.AA.JCL')
  .then(function() {
    console.log('Deleted');
  })
  .catch(function(err) {
    // handle error
  });
```

#### Rename

`rename(oldDataset, newDataset)` - Renames oldDataset to newDataset.

##### Parameter

* oldDataset - _string_ -  Old dataset name.
* newDataset - _string_ -  New dataset name to rename to.

##### Return

A promise that resolves on success, rejects on error.

##### Example

```js
connection.rename('HQL.AA.JCL', 'HQL.BB.JCL')
  .then(function() {
    console.log('Renamed');
  })
  .catch(function(err) {
    // handle error
  });
```

### JES jobs

#### List jobs

`listJobs(jobNameOrOption)` - List JES jobs matching the given jobName or query option. The following parameters are accepted:

##### Parameter

* jobName - specify a JES job name, it can contain a wildcard (*)

##### Parameter

* option - _object_ -  Option which contains:
  *  jobName - _string_ - specify a JES job name, which is optional and can contain a wildcard (*)
  *  jobId - _string_ - specify a JES job ID, which is optional
  *  owner - _string_ - specify a JES job owner, which is optional and can contain a wildcard (*)
  *  status - _string_ - specify a JES job status, eg. ALL, OUTPUT, which is optional  

##### Return

A promise that resolves an array of jobs, each item in the array is a string separated by space, for JESINTERFACELEVEL=2, those fields are JOBNAME, JOBID, OWNER, STATUS, CLASS

##### Example

```js
connection.listJobs({jobName: 'TSU*', owner: 'MY-NAME'})
  .then(function(jobList) {
  })
  .catch(function(err) {
    // handle error
  });
```

#### Submit JCL

`submitJCL(JCLText, cfg)` - Submit raw JCL text to JES server, or submitting built-in helper JCLs

##### Parameter

* JCLText - _string_ -  The raw JCL string to be submitted, or the name of built-in JCLs if `cfg` is specified.
* cfg - _object_ - configurations to the JCL, if this parameter is specified, then JCLText should be a name of the built-in JCLs, and the `cfg` should contain parameters for that JCL. Following is a list of built-in JCLs and their supported configurations:

    * <h6>Allocate dataset</h6>

      * name: `ALLOC`
      * supported configurations: 

      ```js
      {
        DSN: 'abc'
      }
      ```

    * <h6>Copy dataset</h6>

      * name: `COPY`
      * supported configurations: 

      ```js
      {
        from: 'abc',
        to: 'edf'
      }
      ```

##### Return

A promise that resolves the submitted job id.

##### Example

* Submit raw JCL

```js
var fs = require('fs');

fs.readFile('./unpaxz.jcl', function(err, jclContent) {
  connection.submitJCL(jclContent)
    .then(function(jobId) {
      console.log('Job id is', jobId);
    })
    .catch(function(err) {
      // handle error
    });
});
```

* Submit a built-in JCL

```js
connection.submitJCL('HRECALLW', {INPUT: 'AA.BB'})
  .then(function(jobId) {
    console.log('Job id is', jobId);
  })
  .catch(function(err) {
    // handle error
  });
```

#### Query job

`queryJob(jobNameOrOption, jobId)` -  Query job status identified by job name and job id. The following parameters are accepted. _(Deprecated, use `getJobStatus` for more details.)_

##### Parameter

* jobName - _string_ -  Name of the job.
* jobId - _string_ -  Id of the job.

##### Parameter

 * option - _object_ - Option which contains:
   *  jobName - _string_ - specify a JES job name, which is optional and can contain a wildcard (*)
   *  jobId - _string_ - specify a JES job ID, which is required
   *  owner - _string_ - specify a JES job owner, which is optional and can contain a wildcard (*)

##### Return

A promise that resolves status of the job, it is one of the following values:

* RC_SUCCESS - Job succeeds
* RC_ACTIVE - Job running
* RC_FAIL - Job fails
* RC_WAITING - Job waiting
* RC_NOT_FOUND - Cannot find job specified by the jobName and jobId

##### Example

```js
connection.queryJob(jobName, jobId)
  .then(function (status) {
      switch(status) {
          case connection.RC_SUCCESS:
              console.log('Job succeeded');
              break;
          case connection.RC_FAIL:
              console.log('Job failed');
              break;
          case connection.RC_ACTIVE:
              console.log('Job running');
              break;
          case connection.RC_NOT_FOUND:
              console.log('Job not found');
              break;
          default:
              console.log('Unknown status');
      }
  });
```

#### Get job status

`getJobStatus(jobIdOrOption)` -  Get job status specified by jobId or query option. The following parameters are accepted:

##### Parameter

* jobId - _string_ -  Specify JES job ID

##### Parameter

* option - _object_ - Option which contains:
  *  jobId - _string_ - specify a JES job ID, which is required
  *  owner - _string_ - specify a JES job owner, which is optional and can contain a wildcard (*)


##### Return

A promise that resolves job status
```js
  {
   jobname: "HRECALLW",
   jobid: "JOB06385",
   owner: "USER",
   status: "OUTPUT",
   class: "A",
   rc: 0,
   retcode: 'RC 0000',
   spoolFiles: [
          {
           id: 2,
           stepname: "JES2",
           procstep: "N/A",
           c: "H",
           ddname: "JESJCL",
           byteCount: 315
         }
   ]}
```

##### Example

```js
connection.getJobStatus(jobId)
  .then(function(jobStatus) {
    console.log('Job status is:');
    console.log(jobStatus);
  })
  .catch(function(err) {
    // handle error
  });
```

#### Get JES spool files

`getJobLog(jobNameOrOption, jobId)` - Get jes spool files identified by jobName and jobId. The following parameters are accepted:

##### Parameter

* jobName - _string_ -  Name of the job. **Default:** '*'
* jobId - _string_ -  Id of the job.
* spoolFileIndex - _string | integer_ - Index of the spool file to get. Number of spool files can be found using `getJobStatus`, specifying 'x' will return all spool files joined with the `!! END OF JES SPOOL FILE !!`. **Default:** 'x'

##### Parameter

* option - _object_ - Option which contains:
  *  jobName: Optional job name, default to '*'
  *  jobId - _string_ - Specify a JES job ID, which is required
  *  fileId - _string_ - Spool file index (1, 2, 3...) or 'x' returning all spool files joined with the `!! END OF JES SPOOL FILE !!`
  *  owner - _string_ - Specify a JES job owner, which is optional and can contain a wildcard (*)


##### Return

A promise that resolves spool files populated by the job

##### Example

```js
connection.getJobLog(jobName, jobId, 'x')
  .then(function(jobLog) {
    console.log('Job id is:');
    console.log(jobLog);
  })
  .catch(function(err) {
    // handle error
  });
```

#### Delete job

`deleteJob(jobIdOrOption)` - Purge/delete job by job id. The following parameters are accepted:

##### Parameter

* jobId - _string_ -  JES job ID

##### Parameter

* option - _object_ - Option which contains:
  *  jobId - _string_ - specify a JES job ID, which is required
  *  owner - _string_ - specify a JES job owner, which is optional and can contain a wildcard (*)

##### Return

A promise that resolves on success, rejects on error.

##### Example

```js
connection.deleteJob('JOB25186')
  .then(function() {
    console.log('Deleted');
  })
  .catch(function(err) {
    // handle error
  });
```

### Others

#### Retrieve Server Status

`stat(option)` - Retrieve status information from a remote server. The following parameters are accepted:

##### Parameter

* option - _string_ -  Optional option name like UMASK

##### Return

A promise that resolves status of the specified option on success, rejects on error. If `option` is not specified, 
it returns all status information.

##### Example

```js
connection.stat('UMASK')
  .then(function(status) {
    console.log(status);
  })
  .catch(function(err) {
    // handle error
  });
```

#### Submit SITE commands

`site(siteCommands)` - Send site-specific information to a server. The following parameters are accepted:

##### Parameter

* siteCommands - _string_ - Site commands separated with space

##### Return

A promise that resolves text from server on success, rejects on error. 

##### Example

```js
connection.site('UMASK 007')
  .then(function(text) {
    console.log(text);
  })
  .catch(function(err) {
    // handle error
  });
```

## Module Long Term Support Policy

This module adopts the [Module Long Term Support (LTS)](http://github.com/CloudNativeJS/ModuleLTS) policy, with the following End Of Life (EOL) dates:

| Module Version   | Release Date | Minimum EOL | EOL With     | Status  |
|------------------|--------------|-------------|--------------|---------|
| 1.x.x	         | Oct 2018    | Dec 2019    |              | Current |

## License

[Eclipse Public License (EPL)](LICENSE)
