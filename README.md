# z/OS Node Accessor

[![Build Status](https://travis-ci.org/IBM/zos-node-accessor.svg)](https://travis-ci.org/IBM/zos-node-accessor)

A Node module to help Node.JS developers interacting with z/OS easily, taking 
advantage of z/OS FTP service. It's recommended to be deployed on z/OS, 
to avoid transferring user account/password in clear-text over network. IBM
SDK for Node.js - z/OS Beta is available at 
[https://developer.ibm.com/node/sdk/ztp/](https://developer.ibm.com/node/sdk/ztp/).

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
var Client = require('zosAccessor');

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

#### List

`listDataset(dsnOrDir)` - List MVS datasets or USS files

##### Parameter

* dsnOrDir - _string_ -  Specify a full qualified MVS dataset name, which can contain wildcard (*). Or USS directory, which **CAN NOT** contain wildcard (*).

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

`uploadDataset(input, destDataset, dataType)` - Upload a local file to MVS dataset or USS file.

##### Parameter

* input - _any_ -  A [ReadableStream](https://nodejs.org/api/stream.html#stream_readable_streams), a [Buffer](https://nodejs.org/api/buffer.html), or a path to a local file that needs uploading.
* destDataset - _string_ -  Dataset name to used to store the uploaded file, if it starts with `/` this file will be uploaded to USS.
* dataType - _string (default: ascii)_ -  Transfer data type, it should be 'ascii' or 'binary', **when transfering 'ascii' files, the end-of-line sequence of input should always be `\r\n`**, otherwise the transfered file will get truncated.

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

#### Read MVS dataset or USS file

`getDataset(dsn, dataType, stream)` - Get the contents of the MVS dataset or USS file.

##### Parameter

* dsn - _string_ -  Specify a full qualified dataset name, or USS file name. It **CAN NOT** contain any wildcard (*).
* dataType - _string (default: 'ascii')_ -  Transfer data type, accepts three options `binary`,  `ascii`, `ascii_strip_eol`. When downloading an ascii dataset, dataType should be either `ascii` or `ascii_strip_eol` so that the FTP server converts `EBCDIC` characters to  `ASCII`, `ascii_strip_eol` tells FTP server not the append a CLRF to the end of each record.
* stream - _boolean (default: false)_ -  `true` if you want to obtain a [ReadableStream](https://nodejs.org/api/stream.html#stream_readable_streams) of the data set content, or `false` to read a full dataset into memory (in Buffer).

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

`listJobs(jobName)` - List JES jobs under a certain job name.

##### Parameter

* jobName - _string_ -  Specify a JES job name, it can contain a wildcard (*).

##### Return

A promise that resolves an array of jobs, each item in the array is a string separated by space, for JESINTERFACELEVEL=2, those fields are JOBNAME, JOBID, OWNER, STATUS, CLASS

##### Example

```js
connection.listJobs('HIS*')
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

`queryJob(jobName, jobId)` -  Query job status identified by job name and job id. _(Deprecated, use `getJobStatus` for more details.)_

##### Parameter

* jobName - _string_ -  Name of the job.
* jobId - _string_ -  Id of the job.

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

`getJobStatus(jobId)` -  Get job status specified by jobId.

##### Parameter

* jobId - _string_ -  Id of the job.

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

`getJobLog(jobName, jobId)` - Get jes spool files identified by jobName and jobId.

##### Parameter

* jobName - _string_ -  Name of the job. **Default:** '*'
* jobId - _string_ -  Id of the job.
* spoolFileIndex - _string | integer_ - Index of the spool file to get. Number of spool files can be found using `getJobStatus`, specifying 'x' will return all spool files joined with the `!! END OF JES SPOOL FILE !!`. **Default:** 'x'

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

`deleteJob(jobId)` - Purge/delete job by job id.

##### Parameter

* jobId - _string_ -  Id of the job.

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

## License

[Eclipse Public License (EPL)](LICENSE)
