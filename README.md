# z/OS Node Accessor

[![Build Status](https://travis-ci.org/IBM/zos-node-accessor.svg)](https://travis-ci.org/IBM/zos-node-accessor)
[![Module LTS Adopted'](https://img.shields.io/badge/Module%20LTS-Adopted-brightgreen.svg?style=flat)](http://github.com/CloudNativeJS/ModuleLTS)
[![IBM Support](https://img.shields.io/badge/Support-IBM%20Runtimes-brightgreen.svg?style=flat)](http://ibm.biz/node-support)

A Node module to help Node.JS developers interacting with z/OS easily, taking advantage of z/OS FTP service. 
If z/OS FTP service is not configured as FTP over SSL, it's recommended to be deployed on z/OS, to avoid transferring user account/password in clear-text over network. 
Otherwise, the secure connection of FTP over SSL is recommended.
IBM SDK for Node.js - z/OS is available at 
[https://developer.ibm.com/mainframe/products/ibm-sdk-for-node-js-z-os/](https://developer.ibm.com/mainframe/products/ibm-sdk-for-node-js-z-os/).

For a [Zowe CLI](https://github.com/zowe/zowe-cli) plugin based on this functionality, see https://github.com/zowe/zowe-cli-ftp-plugin

## Installation & Test

```bash
npm install zos-node-accessor   # Put latest version in your package.json
```

## Features

* List MVS dataset or USS files
* Download/Upload MVS dataset or USS files
* Submit JCL and query its status to track its completion
* Access SYSOUT dataset

## Migration from v1

`zos-node-accessor` is rewritten in TypeScript, and defines API methods in more consistent way. So some old API methods are renamed. Here are about some details useful when you migrate the code using `zos-node-accessor` v1 to v2.

* `listDataset(...)` is renamed to `listDatasets(...)`
* `getDataset(...)` is split and renamed to `downloadFile` and `downloadDataset(...)`
* `queryJob(...)` returns the enum member of `JobStatusResult`
* Job methods takes the query option object like `JobIdOption`, `JobLogOption`, or `JobListOption`
* `rename(...)` is split and renamed to `renameFile(...)` and `renameDataset(...)`
* `delete(...)` is split and renamed to `deleteFile(...)` and `deleteDataset(...)`

Many list methods in v2 like `listDatasets(...)` and `listFiles(...)` returns the objects with the type like `DataSetEntry`, instead of the key/value pairs in v1. To make the migration easier, you can enable migrationMode to have `zos-node-accessor` return the v1 key/value pairs, so that you can take time to change code to use the types object. This migration mode will be dropped in future. Let us know, if you have problem in removing the code using the key/value pairs.

```
    const zosAccessor = new ZosAccessor();
    zosAccessor.setMigrationMode(true);
    var connectionInfo = {
        ....
    };
    await zosAccessor.connect(connectionInfo)
```

## Usage

This accessor leverages z/OS FTP server to interact with z/OS. To work with z/OS JES better, it requires `JESINTERFACELevel` set to `2` on z/OS FTP settings.

* [Connection](#connection)
* [MVS dataset](#mvs-dataset)
  * [Allocate dataset](#allocate-dataset)
  * [List datasets](#list-datasets)
  * [List members of PDS dataset](#list-members-of-pds-dataset)
  * [Upload dataset](#upload-mvs-dataset)
  * [Download dataset](#download-mvs-dataset)
  * [Delete dataset](#delete-dataset)
  * [Rename dataset](#rename-dataset)
* [USS file or directory](#uss-file-or-directory)
  * [Make directory](#make-directory)
  * [List files](#list-files)
  * [Upload file](#upload-uss-file)
  * [Download file](#download-uss-file)
  * [Delete file](#delete-uss-file)
  * [Rename file](#rename-uss-file)
* [JES jobs](#jes-jobs)
  * [List jobs](#list-jobs)
  * [Submit JCL](#submit-jcl)
  * [Query job status](#query-job)
  * [Get job status](#get-job-status)
  * [Get JES spool files](#get-jes-spool-files)
  * [Delete job](#delete-job)
* [Others](#others)
  * [Retrieve Server Status](#retrieve-server-status)
  * [Submit SITE commands](#submit-site-commands)

### Connection

Before connecting to a z/OS server, you need to initialize an instance using the constructor `new ZosAccessor()`, then call the `connect(option: ConnectionOption)` method, where:

##### Parameter

* option - _ConnectionOption_ - Configuration passed to the underlying ftp library.

ConnectionOption
  * user - _string_ - Username for authentication on z/OS. **Default:** 'anonymous'
  * password - _string_ - Password for authentication on z/OS. **Default:** 'anonymous@'
  * host - _string_ - The hostname or IP address of the z/OS server to connect to. **Default:** 'localhost'
  * port - _number_ - The port of the z/OS FTP server. **Default:** 21
  * secure - _boolean_ - Set to true for both control and data connection encryption. **Default:** false
  * secureOptions - _object_ - Additional options to be passed to `tls.connect()`. **Default:** (none)
  * connTimeout - _number_ - How long (in milliseconds) to wait for the control connection to be established. **Default:** 30000
  * pasvTimeout - _number_ - How long (in milliseconds) to wait for a PASV data connection to be established. **Default:** 30000
  * keepalive - _number_ - How often (in milliseconds) to send a 'dummy' (NOOP) command to keep the connection alive. **Default:** 10000

##### Return

A promise that resolves itself (ZosAccessor object), and rejects on any error.

##### Example

```ts
import { ZosAccessor } from '../zosAccessor';

const accessor = new ZosAccessor();
await accessor.connect({
    user: 'myname',
    password: 'mypassword',
    host: 'localhost',
    port: 21,
    pasvTimeout: 60000,
    secure: true,
    secureOptions: {
        ca: [ caBuffer ]
    }
});
```

### MVS dataset

#### Allocate Dataset

`allocateDataset(datasetName: string, allocateParamsOrString?: string | AllocateParams)` - Allocate sequential or partition (with the DCB attribut "DSORG=PO") dataset.

##### Parameter

* datasetName - _string_ -  Dataset name to allocate.
* allocateParams - _string | AllocateParams_ -  A string of space separated DCB attributes or an object of DCB attribute key-value pairs, eg. "LRECL=80 RECFM=VB" or {"LRECL": 80, "RECFM": "VB"}. The tested attributes includes BLKsize/BLOCKSize, Directory, DSORG, LRecl, PDSTYPE, PRImary, RECfm, SECondary, and TRacks.

Here is the complete list that z/OS FTP supports. Part of them are verified.

Option Key | Description
---- | ---
SPACETYPE	|	allocation units
BLKSIZE	|	blocksize
DATACLASS	|	data class
DIRECTORY	|	directory blocks
DSNTYPE	|	data set name type
EATTR	|	extended attributes
LRECL	|	logical record length
MGMTCLASS	|	management class
DCBDSN	|	model DCB values
PDSTYPE	|	PDS type
PRIMARY	|	primary space
RECFM	|	record format
RETPD	|	retention period
SECONDARY	|	secondary space
STORCLASS	|	storage class
UNITNAME	|	unit
VCOUNT	|	volume count
UCOUNT	|	unit count
VOLUME	|	volume serial number

##### Return

A promise that resolves on success, rejects on error.

##### Example

```ts
await connection.allocateDataset('HLQ.ABC.DEF', 'LRECL=80 RECFM=FB BLKSIZE=320');
```

```js
await connection.allocateDataset('HLQ.ABC.PDS', {'LRECL': 80, 'RECFM': 'FB', 'BLKSIZE': 320, 'DSORG': 'PO', 'DIRECTORY': 20});
```
#### List Datasets

`listDatasets(dsn: string)` - Lists the datasets whose names match with the given dataset name.

Note: This method is renamed from `listDataset(dsnOrDir)` in v1.0.x, to be consistent with the other list methods.

##### Parameter

* dsn - _string_ -  Full qualified name of dataset, or dataset name with wildcards (* or ?)

##### Return

A promise that resolves a list of `DatasetEntry`.

DatasetEntry

* blockSize - _number_ - Block size
* dsOrg - _string_ - Dataset organization
* extends - _number_ - How many extends
* name - _string_ - Dataset name
* isMigrated - _boolean_ - Is migrated or not. When migrated, many attributes like recordLength is unknown.
* recordFormat - _string_ - Record format
* recordLength - _number_ - Record length
* referred - _string_ - Last referred date
* unit - _string_ - Device unit
* usedTracks - _number_ - Used tracks
* volume - _string_ - Volume

##### Example

```ts
await connection.listDatasets('HQL.*.JCL');
for (const entry of list) {
  console.log('name:', entry.name, 'dsorg', entry.dsOrg);
}
```

#### List members of PDS dataset

`listMembers(partitionDsn: string)` - Lists the members of partition dataset

##### Parameter

* partitionDsn - _string_ -  Full qualified name of partition dataset

##### Return

A promise that resolves a list of `DatasetMemberEntry`.

DatasetMemberEntry

* changed - _string_ - Changed date
* created - _string_ - Created date
* name - _string_ - Member name
* size - _number_ - Size
* version - _string_ - Version

#### Upload MVS dataset

`uploadDataset(input: Input, destDataset: string, transferMode: TransferMode = TransferMode.ASCII, allocateParamsOrString?: string | AllocateParams)` - Uploads data to the specified dataset on z/OS.

##### Parameter

* input - _Input_ -  Input, which can be a [ReadableStream](https://nodejs.org/api/stream.html#stream_readable_streams), a [Buffer](https://nodejs.org/api/buffer.html), or a path to a local file.
* destDataset - _string_ -  Name of the dataset to store the uploaded data.
* transferMode - TransferMode_ -  Data transfer mode, either TransferMode.ASCII or TransferMode.BINARY. **When transfering 'ascii' files, the end-of-line sequence of input should always be `\r\n`**. Otherwise the transfered file will get truncated.
* allocateParamsOrString - _string | AllocateParams_ -  A string of space separated DCB attributes or an object of DCB attribute key-value pairs, eg. "LRECL=80 RECFM=VB" or {"LRECL": 80, "RECFM": "VB"}. The tested attributes: BLKsize/BLOCKSize, LRecl, RECfm, PRImary, SECondary, TRacks.

##### Return

A promise that resolves on success, rejects on error.

##### Example

```ts
import * as fs from 'fs';

const input = fs.readFileSync('/etc/hosts', 'utf8').replace(/\r?\n/g, '\r\n');
await connection.uploadDataset(input, 'HLQ.HOSTS');
await connection.uploadDataset(input, 'HLQ.HOSTS', "LRECL=80 RECFM=FB");
```

#### Download MVS dataset

`downloadDataset(dsn: string, transferMode: TransferMode = TransferMode.ASCII, stream = false)` - Downloads the specified dataset or member of patition dataset.

##### Parameter

* dsn - _string_ -  Specify a full qualified dataset name, or USS file name. It **CAN NOT** contain any wildcard (*).
* transferMode - _TransferMode_ -  `TransferMode.ASCII`, `TransferMode.BINARY`, `TransferMode.ASCII_STRIP_EOL`, `TransferMode.ASCII_RDW`, or `TransferMode.BINARY_RDW`. When downloading a text dataset, transferMode should be either `TransferMode.ASCII` or `TransferMode.ASCII_STRIP_EOL` so that z/OS FTP service converts `EBCDIC` characters to  `ASCII`. `TransferMode.ASCII_STRIP_EOL` asks z/OS FTP service not to append a `CLRF` to the end of each record. `TransferMode.ASCII_RDW` and `TransferMode.BINARY_RDW` support to download variable length dataset, which add 4-byte Record Description Word (RDW) at the beginning of each record.
* stream - _boolean_ -  `true` if you want to obtain a [ReadableStream](https://nodejs.org/api/stream.html#stream_readable_streams) of the data set content, or `false` to read a full dataset into memory (in Buffer). The buffer accepts up to 4MB data. For large dataset, use `stream=true` instead.

##### Return

A promise that resolves content of the dataset in either `Buffer` or `ReadableStream`.

##### Example

```ts
const jclBuffer = await connection.downloadDataset('HQL.AA.JCL', TransferMode.ASCII);
console.log('JCL is:');
console.log(jclBuffer.toString());

const jclStream = await connection.downloadDataset('HQL.AA.JCL(MEMBER1)', TransferMode.ASCII, true);
const writable = fs.createWriteStream('file.txt');
jclStream.pipe(writable);
```

#### Delete dataset

`deleteDataset(dsn)` - Deletes the dataset or member of parition dataset whose names match with the given dataset name.

##### Parameter

* dsn - _string_ -  Specify a full qualified dataset name to delete. It **CAN NOT** contain a wildcard (*).

##### Return

A promise that resolves on success, rejects on error.

##### Example

```ts
await connection.deleteDataset('HQL.AA.JCL');
```

#### Rename dataset

`renameDataset(dsn: string, newDsn string)` - Renames dataset, member in partition dataset.

##### Parameter

* dsn - _string_ -  Old dataset name.
* newDsn - _string_ -  New dataset name to rename to.

##### Return

A promise that resolves on success, rejects on error.

##### Example

```ts
await connection.renameDataset('HQL.AA.JCL', 'HQL.BB.JCL')
```

### USS file or directory

#### Make directory

`makeDirectory(directoryName: string)` - Makes USS directory with the given directory name.

##### Parameter

* directoryName - _string_ -  Makes USS directory with the given directory name.

##### Return

A promise that resolves on success, rejects on error.

##### Example

```ts
await connection.makeDirectory('/u/user/my_directory'});
```

#### List files

`listFiles(dirPath: string)` - Lists files whose names match with the given path name.

##### Parameter

* dirPath - _string_ -  Directory to list or file name with widecards (* or ?)

##### Return

A promise that resolves a list of `USSEntry`.

USSEntry

* name - _string_ - File or directory name
* group - _string_ - Group
* fileType - _FileType_ - File type
* linkedTo - _string_ - The target file if this entry is the link
* lastModified - _Date_ - Last modified date
* owner - _string_ - Owner
* permissions - _string_ - Permission string
* size - _number_ - File size

##### Example

```ts
const list = await connection.listFiles('/u/user1/');
for (const entry of list) {
    console.log(entry.name, entry.owner, entry.group, entry.size);
}
```

#### Upload USS file

`uploadFile(input: Input, destFilePath: string, transferMode: TransferMode = TransferMode.ASCII)` - Uploads data to the specified USS file on z/OS.

##### Parameter

* input - _Input_ -  Input, which can be a [ReadableStream](https://nodejs.org/api/stream.html#stream_readable_streams), a [Buffer](https://nodejs.org/api/buffer.html), or a path to a local file.
* destFilePath - _string_ -  Path name of the destination file on z/OS.
* transferMode - TransferMode_ -  Data transfer mode, either TransferMode.ASCII or TransferMode.BINARY. 

##### Return

A promise that resolves on success, rejects on error.

##### Example

```ts
import * as fs from 'fs';

const input = fs.readFileSync('/etc/hosts', 'utf8');
await connection.uploadFile(input, '/u/username/hosts');
```

#### Download USS file

`downloadFile(filePath: string, transferMode: TransferMode = TransferMode.ASCII, stream = false)` - Downloads the specified USS file.

##### Parameter

* filePath - _string_ -  USS file path name.
* transferMode - _TransferMode_ -  `TransferMode.ASCII`, `TransferMode.BINARY`. When downloading a text dataset, transferMode should be either `TransferMode.ASCII` so that z/OS FTP service converts `EBCDIC` characters to  `ASCII`.
* stream - _boolean_ -  `true` if you want to obtain a [ReadableStream](https://nodejs.org/api/stream.html#stream_readable_streams) of the file content, or `false` to read a full file into memory (in Buffer). The buffer accepts up to 4MB data. For large file, use `stream=true` instead.

##### Return

A promise that resolves content of the file in either `Buffer` or `ReadableStream`.

##### Example

```ts
const jclBuffer = await connection.downloadFile('/etc/hosts', TransferMode.ASCII);
console.log('JCL is:');
console.log(jclBuffer.toString());

const jclStream = await connection.downloadFile('/etc/hosts', TransferMode.ASCII, true);
const writable = fs.createWriteStream('file.txt');
jclStream.pipe(writable);
```

#### Delete USS file

`deleteFile(filePath: string, fileType: FileToOperate = FileToOperate.FILE_OR_DIRECTORY)` - Deletes the USS files or directory whose names match with the given file path.

##### Parameter

* filePath - _string_ -  The path name of USS file or directory. It **CAN NOT** contain a wildcard (*).

##### Return

A promise that resolves on success, rejects on error.

##### Example

```ts
await connection.deleteFile('/u/username/myfile');
await connection.deleteFile('/u/username/mydir');                                // Delete it, if it's empty
await connection.deleteFile('/u/username/mydir', FileToOperate.WHOLE_DIRECTORY); // Delete it, even if it's not empty.
```

#### Rename USS file

`renameFile(name: string, newName: string)` - Renames USS file/directory.

##### Parameter

* name - _string_ -  Old file name.
* newName - _string_ -  New file name to rename to.

##### Return

A promise that resolves on success, rejects on error.

##### Example

```ts
await connection.renameFile('/u/username/myfile', '/u/username/newfile')
```

### JES jobs

#### List jobs

`listJobs(queryOption?: JobListOption)` - Lists the jobs matching the given query option. If the query option is not provided, it will list all jobs of the current user.

##### Parameter

* queryOption - _JobListOption_ - Query option

JobListOption
* jobName - _string_ - Job name, which is optional and can contain a wildcard (\*). **Default**: '*'
* jobId - _string_ - Job ID, which is optional
* owner - _string_ - Job owner, which is optional and can contain a wildcard (\*). **Default**: The current user
* status - _string_ - Job status, eg. ALL, OUTPUT, which is optional. **Default**: 'ALL'

##### Return

A promise that resolves an array of `Job`. For JESINTERFACELEVEL=2, `Job` contains valid `jobName`, `jobId`, `owner`, `status`, `class`.

Job
* jobName - _string_ - Job name
* jobId - _string_ - Job ID
* owner - _string_ - Job owner
* status - _string_ - Job status
* class - _string_ - Job class
* extra - _string_ - Extra information

##### Example

```ts
const jobs: Job[] = await connection.listJobs({jobName: 'TSU*', owner: 'MY-NAME'})
```

#### Submit JCL

`submitJCL(jclText: string)` - Submits job with the specified JCL text.

##### Parameter

* jclText - _string_ -  JCL text to submit

##### Return

A promise that resolves the submitted job id.

##### Example

```ts
import * as fs from 'fs';

const jcl = fs.readFileSync('./unpaxz.jcl');
const jobId = await connection.submitJCL(jcl);
```

#### Query job

`queryJob(queryOption: JobIdOption)` -  Returns the status the job identified by job id and optional job name.

##### Parameter

 * queryOption - _JobIdOption_ - Job query option
 
JobIdOption
*  jobId - _string_ - Job ID, which is required
*  jobName - _string_ - Job name, which is optional and can contain a wildcard (\*). Better to have it, if it's known. **Default**: '*'
*  owner - _string_ - Job owner, which is optional. **Default**: The current user

##### Return

A promise that resolves status of the job, `JobStatusResult`.

JobStatusResult
* SUCCESS - Job succeeds
* ACTIVE - Job running
* FAIL - Job fails
* WAITING - Job waiting
* NOT_FOUND - Cannot find job specified by the jobName and jobId

##### Example

```ts
const status = await connection.queryJob(jobName, jobId);
switch(status) {
    case JobStatusResult.SUCCESS:
        console.log('Job succeeded');
        break;
    case JobStatusResult.FAIL:
        console.log('Job failed');
        break;
    case JobStatusResult.ACTIVE:
        console.log('Job is running');
        break;
    case JobStatusResult.WAITING:
        console.log('Job is waiting');
        break;
    case JobStatusResult.NOT_FOUND:
        console.log('Job is not found');
        break;
}
```

#### Get job status

`getJobStatus(queryOption: JobIdOption)` - Returns the status of the job specified by query option.

##### Parameter

* queryOption - _JobIdOption_ - Job ID option

JobIdOption
*  jobId - _string_ - Job ID, which is required
*  jobName - _string_ - Job name, which is optional and can contain a wildcard (\*). Better to have it, if it's known. **Default**: '*'
*  owner - _string_ - Job owner, which is optional. **Default**: The current user

##### Return

A promise that resolves job status, `JobStatus`.

JobStatus
* jobName - _string_ - Job name
* jobId - _string_ - Job ID
* owner - _string_ - Job owner
* status - _string_ - Job status
* class - _string_ - Job class
* extra - _string_ - Extra information
* rc - _string | number_ - Job RC value, indicating job finished with numberic value or failed with error string
* retcode - string - Job RC value, to support zftp plugin with consistent return code format with z/OSMF.
* spoolFiles - _SpoolFile[]_ - Spool files

SpoolFile
* id - _number_ - Spool file ID
* stepName - _string_ - Job step name
* procStep - _string_ - Proc step name
* class - _string_ - Class
* ddName - _string_ - DD name
* byteCount - _number_ - Bytes


##### Example

```ts
const jobStatus = await connection.getJobStatus(jobId);
```

#### Get JES spool files

`getJobLog(queryOption: JobLogOption)` - Returns job spool files identified by jobId.

##### Parameter

* queryOption - _JobLogOption_ - Job log query option

JobLogOption
*  fileId - _number_ - Spool file index (1, 2, 3...), or -1, which returns all spool files separated by `!! END OF JES SPOOL FILE !!`. **Default**: -1
*  jobId - _string_ - Job ID, which is required
*  jobName - _string_ - Job name, which is optional and can contain a wildcard (\*). **Default**: '*'
*  owner - _string_ - Job owner, which is optional. **Default**: The current user

##### Return

A promise that resolves spool files' contents.

##### Example

```ts
const spoolFileContents = await connection.getJobLog({ jobName, jobId, fileId: -1 });
spoolFileContents.split(/\s*!! END OF JES SPOOL FILE !!\s*/)
    .forEach(function (spoolFile, i) {
        if (spoolFile.length > 0) {
            console.log(`Spool file ${i}:`);
            console.log(spoolFile);
        }
    });
```

#### Delete job

`deleteJob(queryOption: JobIdOption)` - Deletes the job of the specified job id.

##### Parameter

* queryOption - _JobIdOption_ - Job query option

JobIdOption
*  jobId - _string_ - Job ID, which is required
*  owner - _string_ - Job owner, which is optional. **Default**: The current user.

##### Return

A promise that resolves on success, rejects on error.

##### Example

```ts
await connection.deleteJob({ jobId: 'JOB25186' });
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

```ts
const status = await connection.stat('UMASK');
console.log(status);
```

#### Submit SITE commands

`site(siteCommands)` - Send site-specific information to a server. The following parameters are accepted:

##### Parameter

* siteCommands - _string_ - Site commands separated with space

##### Return

A promise that resolves text from server on success, rejects on error. 

##### Example

```js
await connection.site('UMASK 007');
```

## Module Long Term Support Policy

This module adopts the [Module Long Term Support (LTS)](http://github.com/CloudNativeJS/ModuleLTS) policy, with the following End Of Life (EOL) dates:

| Module Version | Release Date | Minimum EOL | Node Version     | EOL With | Status  |
|----------------|--------------|-------------|------------------|----------|---------|
| 2.x.x	         | May 2020     | May 2022    | v8, v10, v12     |          | Current |
| 1.x.x	         | Oct 2018     | Dec 2019    | v6, v8, v10, v12 | Node v6  | EOL     |

## License

[Eclipse Public License (EPL)](LICENSE)
