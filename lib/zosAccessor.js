/****************************************************************************/
/*                                                                          */
/* Copyright (c) 2017 IBM Corp.                                             */
/* All rights reserved. This program and the accompanying materials         */
/* are made available under the terms of the Eclipse Public License v1.0    */
/* which accompanies this distribution, and is available at                 */
/* http://www.eclipse.org/legal/epl-v10.html                                */
/*                                                                          */
/* Contributors:                                                            */
/*  IBM Corp. - initial API and implementation                              */
/*                                                                          */
/****************************************************************************/


// DO NOT use strict mode, otherwise `arguments.callee.caller` will fail
// 'use strict';

var Parser = require('ftp/lib/parser');
Parser.parseListEntry = function (line) {
    return line;
};
var Client = require('ftp');
var debug = require('debug')('zos-accessor');
var Q = require('q');

function ZosAccessor() {
    this.client = new Client();
    this.connected = false;
}

module.exports = ZosAccessor;

/**
 * Connect to z/OS via FTP, valid config properties:
 * 
 * user - Username for authentication on z/OS.
 * password - Password for authentication on z/OS.
 * host - The hostname or IP address of the z/OS server to connect to, default is 'localhost'.
 * port - The port of the z/OS FTP server, default is 21.
 * secure - Set to true for both control and data connection encryption, 'control' for control connection encryption only, or 'implicit' for implicitly encrypted control connection (this mode is deprecated in modern times, but usually uses port 990), default is false.
 * secureOptions - Additional options to be passed to `tls.connect()`, default is (none)
 * connTimeout - How long (in milliseconds) to wait for the control connection to be established, default is 10000.
 * pasvTimeout - How long (in milliseconds) to wait for a PASV data connection to be established, default is 10000.
 * keepalive - How often (in milliseconds) to send a 'dummy' (NOOP) command to keep the connection alive, default is 10000.
 */
ZosAccessor.prototype.connect = function (options) {
    var deferred = Q.defer();
    var self = this;
    self.username = options.username;
    this.client.on('ready', function () {
        self.connected = true;
        deferred.resolve(self);
    }).on('error', function (err) {
        self.connected = false;
        deferred.reject(err);
    }).on('close', function (hasErr) {
        self.connected = false;
        debug('User', self.username, 'disconnected from ftp.');
    });
    this.client.connect(options);
    return deferred.promise;
};

/**
 * Close connection to z/OS
 */
ZosAccessor.prototype.close = function () {
    this.client.end();
};

//==================================Dataset related operations=================

/**
 * Upload data/file to the server to be stored as destDataset
 *
 * input - Can be a ReadableStream, a Buffer, or a path to a local file.
 * destDataset - Dataset name to used to store the uploaded file.
 * dataType - Transfer data type, it should be 'ascii' or 'binary',
 *            when transfering 'ascii' files, the end-of-line sequence of input should always be '\r\n',
 *            otherwise the transfered file will get truncated.
 */
ZosAccessor.prototype.uploadDataset = function(input, destDataset, dataType) {
    var deferred = Q.defer();
    var ftpClient = this.client;
    var self = this;
    dataType = dataType || 'ascii';
    if(dataType !== 'ascii' && dataType !== 'binary') {
        throw new Error('Unsupported data type: ' + dataType);
    }
    ftpClient[dataType](function (err) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.site('FILETYPE=SEQ', function (err, responseText, responseCode) {
            if (err) {
                return deferred.reject(err);
            }
            ftpClient.put(input, destDataset, function (err) {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve();
                }
            });
        });
    });
    return deferred.promise;
};

/**
 * Download dataset.
 * 
 * dsn - Dataset name
 * dataType - 'ascii' or 'binary' or 'ascii_strip_eol'
 * stream - Resolve stream as result or not
 */
ZosAccessor.prototype.getDataset = function (dsn, dataType, stream) {
    var deferred = Q.defer();
    var ftpClient = this.client;
    dataType = dataType || 'ascii';
    if(dataType !== 'ascii' && dataType !== 'binary' && dataType !== 'ascii_strip_eol') {
        throw new Error('Unsupported data type: ' + dataType);
    }
    var sbsendeol = 'SBSENDEOL=CRLF';
    if (dataType === 'ascii_strip_eol') {
        sbsendeol = 'SBSENDEOL=NONE';
        dataType = 'ascii';
    }
    ftpClient[dataType](function (err) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.site('FILETYPE=SEQ', function (err, responseText, responseCode) {
            if (err) {
                return deferred.reject(err);
            }
            ftpClient.site(sbsendeol, function (err, responseText, responseCode) {
                if (err) {
                    return deferred.reject(err);
                }
                dsn = ensureFullQualifiedDSN(dsn);
                ftpClient.get(dsn, function (err, readStream) {
                    if (err) {
                        return deferred.reject(err);
                    }
                    if (stream) {
                        return deferred.resolve(readStream);
                    }
                    var chunks = [];
                    readStream.on('data', function (chunk) {
                        chunks.push(chunk);
                    });
                    readStream.on('end', function () {
                        deferred.resolve(Buffer.concat(chunks));
                    });
                    readStream.on('error', function (err) {
                        deferred.reject(err);
                    });
                });
            });
        });
    });
    return deferred.promise;
};

/**
 * List a dataset
 * 
 * dsn - Specify a full qualified dataset name, it can contain a wildcard (* or ?)
 */
ZosAccessor.prototype.listDataset = function (dsn) {
    var deferred = Q.defer();
    var ftpClient = this.client;
    var self = this;
    ftpClient.ascii(function (err) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.site('FILETYPE=SEQ', function (err, responseText, responseCode) {
            if (err) {
                return deferred.reject(err);
            }
            dsn = ensureFullQualifiedDSN(dsn);
            ftpClient.list(dsn, function (err, list) {
                if (err) {
                    if (err.code === 550 && list === undefined && err.message.indexOf('No data sets found') !== -1) {
                        // No dataset is found.
                        deferred.resolve([]);
                    } else {
                        deferred.reject(err);
                    }
                } else {
                    if(list[0].match(/^total/)) {
                        deferred.resolve(self.parseUSSDirList(list));
                    } else {
                        deferred.resolve(self.parseMVSDataSets(list));
                    }
                }
            });
        });
    });
    return deferred.promise;
};

/**
 * Parse a list of USS directory list strings
 */
ZosAccessor.prototype.parseUSSDirList = function (dirList) {
    var headLine = dirList.shift();
    if (!headLine.match(/^total/)) {
        throw new Error('Cannot recognize the USS file list.');
    }
    var monthText = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var headers = ['permissions', 'links', 'owner', 'group', 'size'];
    var entries = [];
    dirList.forEach(function (line) {
        var entry = {rawString: line};
        var fields = line.split(/\s+/);
        for(var i=0; i<headers.length; ++i) {
            entry[headers[i]] = fields[i];
        }
        entry['lastModified'] = new Date(fields[7], monthText.indexOf(fields[5]), fields[6]);
        entry['name'] = fields.slice(8).join(' ');
        entries.push(entry);
    });
    return entries;
};

/**
 * Parse a list of MVS dataset list strings
 */
ZosAccessor.prototype.parseMVSDataSets = function (dirList) {
    var headLine = dirList.shift();
    // startsWith doesn't work on Z
    if (!headLine.match(/^Volume Unit/) && headLine.indexOf('VV.MM') === -1) {
        throw new Error('Cannot recognize the data set list.');
    }
    var footLine = dirList[dirList.length-1];
    if (footLine.toLowerCase().indexOf('list completed successfully') !== -1) {
        dirList.pop();
    }

    //  012345678901234567890123456789012345678901234567890123456789012345678901234567890
    // 'Volume Unit    Referred Ext Used Recfm Lrecl BlkSz Dsorg Dsname',
    // 'XRFS79 3390   2017/08/04  1 4080  FB    1024 27648  PS  \'USERHLQI.T1.HISPAXZ\'',
    // 'XRFS95 3390   2017/08/04  313875  FB    1024 27648  PS  \'USERHLQI.T2.HISPAXZ\'',
    // 'XRFS61 3390   2017/08/04  1 4500  FB    1024 27648  PS  \'USERHLQI.T3.HISPAXZ\'',
    // 'XRFS67 3390   2017/08/04  314760  FB    1024 27648  PS  \'USERHLQI.T4.HISPAXZ\''

    var headers = headLine.split(/\s+/);
    var positions = [ ];
    var lastPosition = 0;
    headers.forEach(function(header) {
        // No header is substring of another header.
        var position = { start: lastPosition, end: headLine.indexOf(header) + header.length };
        positions.push(position);
        lastPosition = position.end;
    });

    var entries = [];
    dirList.forEach(function (line) {
        var entry = {rawString: line};
        var fields = line.split(/\s+/);

        // The Migrated line is special. Process this special case first.
        if (fields[0] === 'Migrated' && fields.length > 1) {
            entry[headers[0]] = 'Migrated';
            var dsname = fields[fields.length - 1];
            entry['Dsname'] = stripQuotes(dsname);
        } else {
            fields = [];
            positions.forEach(function(position, index) {
                var end = position.end;
                if (line.length > end + 1 && line[end] !== ' ' && line[end + 1] === ' ') {
                    // Look one more char, in the following case
                    //
                    // 'Volume Unit    Referred Ext Used Recfm Lrecl BlkSz Dsorg Dsname',
                    // 'XRFS95 3390   2017/08/04  313875  FB    1024 27648  PS  \'USERHLQI.T2.HISPAXZ\'',
                    //                         ^^
                    //                         ||
                    //                         |+--- the char after the end position is ' '
                    //                         +---- the char at the end position is not ' '
                    end ++;

                    // Adjust the next start/end pair
                    positions[index + 1].start = end;
                }
                if (index === positions.length - 1) {
                    end = line.length;
                }
                var field = line.substring(position.start, end);
                fields.push(field.trim());
            });
            if (fields.length === headers.length) {
                for(var i=0; i<headers.length; ++i) {
                    if (fields[i].match(/\d{4}\/\d{2}\/\d{2}/)) {
                        var parts = fields[i].split('/');
                        fields[i] = new Date(parts[0], parts[1]-1, parts[2]); // Note: months are 0-based
                    } else if(headers[i] === 'Dsname') {
                        fields[i] = stripQuotes(fields[i]);
                    }
                    entry[headers[i]] = fields[i];
                }
            }
        }
        entries.push(entry);
    });
    return entries;

};

/**
 * Delete a dataset or USS file.
 * 
 * dataset - dataset to delete
 */
ZosAccessor.prototype.deleteDataset = function (dataset) {
    var deferred = Q.defer();
    dataset = ensureFullQualifiedDSN(dataset);
    var ftpClient = this.client;
    ftpClient.site('FILETYPE=SEQ', function (err, responseText, responseCode) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.delete(dataset, function (err) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve();
            }
        });
    });
    return deferred.promise;
};

/**
 * Renames oldDataset to newDataset.
 *
 * oldDataset - old dataset name
 * newDataset - new dataset name to rename to
 */
ZosAccessor.prototype.rename = function (oldDataset, newDataset) {
    var deferred = Q.defer();
    oldDataset = ensureFullQualifiedDSN(oldDataset);
    newDataset = ensureFullQualifiedDSN(newDataset);
    var ftpClient = this.client;
    ftpClient.site('FILETYPE=SEQ', function (err, responseText, responseCode) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.rename(oldDataset, newDataset, function (err) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve();
            }
        });
    });
    return deferred.promise;
};

//==================================JES related operations=====================

/**
 * List JES jobs under a certain job name
 * 
 * jobName - Specify a JES job name, it can contain a wildcard (* or ?)
 */
ZosAccessor.prototype.listJobs = function (jobName) {
    var deferred = Q.defer();
    var ftpClient = this.client;
    ftpClient.ascii(function (err) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.site('FILETYPE=JES', function (err, responseText, responseCode) {
            if (err) {
                return deferred.reject(err);
            }
            ftpClient.site('JESJOBNAME=' + jobName, function (err, responseText, responseCode) {
                if (err) {
                    return deferred.reject(err);
                }
                ftpClient.list(function (err, list) {
                    if (err) {
                        if (err.code === 550) {
                            // No job meets this condition
                            debug('No job is found under name ' + jobName);
                            deferred.resolve([]);
                        } else {
                            deferred.reject(err);
                        }
                    } else {
                        deferred.resolve(list);
                    }
                });
            });
        });
    });
    return deferred.promise;
};

// Status from JES 
ZosAccessor.RC_SUCCESS = 'success';
ZosAccessor.RC_ACTIVE = 'active';
ZosAccessor.RC_FAIL = 'fail';
ZosAccessor.RC_WAITING = 'waiting';
ZosAccessor.RC_NOT_FOUND = 'not found';

/**
 * Get JCL status identified by job name and job id
 * 
 * jobName - Name of the job
 * jobId - ID of the job
 */
ZosAccessor.prototype.queryJob = function (jobName, jobId) {
    var self = this;
    return self.listJobs(jobName).then(function (fileList) {
        // Skil the first line, which is the header line.
        for (var i = 1; i < fileList.length; ++i) {
            var fields = fileList[i].toUpperCase().split(/\s+/);
            // For JESINTERFACELEVEL=2, those fields are JOBNAME, JOBID, OWNER, STATUS, CLASS
            if (fields.length > 3 && fields[1] === jobId.toUpperCase()) {
                if(fields[3] === 'INPUT') {
                    return ZosAccessor.RC_WAITING;
                } else if (fields[3] === 'HELD') {
                    return ZosAccessor.RC_FAIL;
                } else if (fields[3] === 'ACTIVE') {
                    return ZosAccessor.RC_ACTIVE;
                } else if (fields[3] === 'OUTPUT' && fields.splice(4).indexOf('RC=0000') !== -1) {
                    return ZosAccessor.RC_SUCCESS;
                }
                debug('Recognize "' + fileList[i] + '" as a job failure');
                return ZosAccessor.RC_FAIL;
            }
        }
        return ZosAccessor.RC_NOT_FOUND;
    });
};

/**
 * Get jes spool files identified by jobName and jobId.
 * 
 * jobName - Name of the job
 * jobId - ID of the job
 */
ZosAccessor.prototype.getJobLog = function (jobName, jobId) {
    var deferred = Q.defer();
    var ftpClient = this.client;
    ftpClient.ascii(function (err) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.site('FILETYPE=JES', function (err, responseText, responseCode) {
            if (err) {
                return deferred.reject(err);
            }
            ftpClient.site('JESJOBNAME=' + jobName, function (err, responseText, responseCode) {
                if (err) {
                    return deferred.reject(err);
                }
                ftpClient.site('SBSENDEOL=CRLF', function (err, responseText, responseCode) {
                    if (err) {
                        return deferred.reject(err);
                    }
                    ftpClient.get(jobId + '.x', function (err, readStream) {
                        if (err) {
                            return deferred.reject(err);
                        }
                        var chunks = [];
                        readStream.on('data', function (chunk) {
                            chunks.push(chunk);
                        });
                        readStream.on('end', function () {
                            deferred.resolve(Buffer.concat(chunks).toString('utf8'));
                        });
                        readStream.on('error', function (err) {
                            deferred.reject(err);
                        });
                    });
                })
            });
        });
    });
    return deferred.promise;
};

/**
 * Submit raw JCL text to JES server
 * 
 * JCLText - The raw JCL string to be submitted
 */
//TODO: support built-in JCL
ZosAccessor.prototype.submitJCL = function(JCLText) {
    var deferred = Q.defer();
    var ftpClient = this.client;
    if (typeof JCLText === 'string') {
        // FTP server requires ascii text ends with \r\n
        JCLText = JCLText.replace(/\r?\n/g, '\r\n');
    }
    var self = this;
    ftpClient.ascii(function (err) {
        if (err) {
            return deferred.reject(err);
        }
        ftpClient.site('FILETYPE=JES', function (err, responseText, responseCode) {
            if (err) {
                return deferred.reject(err);
            }
            ftpClient.put(new Buffer(JCLText), 'PLACEHOL', function (err) {
                if (err) {
                    deferred.reject(err);
                } else {
                    var matched = arguments.callee.caller.arguments[1].match(/JES as (\w+)\s/i);
                    if (!matched || matched.length !== 2) {
                        deferred.reject(new Error('Failed to submit jcl, job id not found'));
                    } else {
                        deferred.resolve(matched[1]);
                    }
                }
            });
        });
    });
    return deferred.promise.then(function (jobId) {
        debug('User', self.username, 'submitted a JCL(' + jobId+ ') successfully.');
        return jobId;
    }, function (err) {
        debug('User', self.username, 'failed to submit a JCL.\n', err);
        return err;
    });
};

function isFullQualifiedDSN(dsn) {
    return dsn[0] === "'" && dsn[dsn.length-1] === "'";
}

function ensureFullQualifiedDSN(dsn) {
    if(dsn.indexOf('/') !== 0 && !isFullQualifiedDSN(dsn)) {
        dsn = "'" + dsn + "'";
    }
    return dsn;
}

function stripQuotes(dsn) {
    if (isFullQualifiedDSN(dsn)) {
        return dsn.substring(1, dsn.length - 1);
    }
    return dsn;
}
