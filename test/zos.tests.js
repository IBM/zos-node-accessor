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


var fs = require('fs');
var path = require('path');
var Q = require('q');
var Client = require('../lib/zosAccessor');

var MAX_QUERIES = 10;           // Query 10 times at most
var QUERY_INTERVAL = 2000;      // 2 seconds

var settingsFilePath = '/build/zos-node-accessor/customSettings.json'; // For running on Jenkins server
if (!fs.existsSync(settingsFilePath)) {
    settingsFilePath = path.join(__dirname, 'customSettings.json');
    if (!fs.existsSync(settingsFilePath)) {
        throw new Error('The settings file, customSettings.json, is not found.');
    }
}
var settings = JSON.parse(fs.readFileSync(settingsFilePath));

var USERNAME = settings.username.toUpperCase();
var PASSWD = settings.password;
var HOST = settings.host;
var PORT = settings.port;

/**
 * This integreation test suite allocates two MVS datasets, take the following actions before run it.
 * 
 * 1) Delete <USERNAME>.NODEACC.TT1
 * 2) Delete <USERNAME>.NODEACC.TT2
 */
describe('Integration test cases for z/OS node accessor', function() {
    jest.setTimeout(60000);
    var _client;

    beforeEach(function() {
        var client = new Client();
        return client.connect({user: USERNAME, password: PASSWD, host: HOST, port: PORT})
            .then(function (client) {
                _client = client;
                if (client.connected) {
                    console.log('Connected to', HOST);
                    return client;
                } else {
                    console.log('Failed to connect to', HOST);
                }
                return Q.reject('Failed to connect to', HOST);
            })
            .catch(function (err) {
                console.log(err);
            });
    });

    afterEach(function() {
        if (_client) {
            _client.close();
        }
    });

    function allocateDataset(dsn, done) {
        var job = ALLOC(dsn);
        submitJob(_client, job)
            .then(function (result) {
            done();
            expect(result.rc).toBe(Client.RC_SUCCESS);
        }).catch(function(err) {
            done(err);
        });
    }

    it('can allocate MVS dataset T1 via JCL', function(done) {
        var dsn = getDSNWithQuotes('NODEACC.TT1');
        _client.deleteDataset(dsn)
            .then(function () {
                allocateDataset(dsn, done);
            }).catch(function(err) {
                allocateDataset(dsn, done);
            });
    });

    it('can allocate MVS dataset T2 via JCL', function(done) {
        var dsn = getDSNWithQuotes('NODEACC.TT2');
        _client.deleteDataset(dsn)
            .then(function () {
                allocateDataset(dsn, done);
            }).catch(function(err) {
                allocateDataset(dsn, done);
            });
    });

    it('can list MVS dataset T1 and T2 with TT*', function(done) {
        _client.listDataset(getDSN('NODEACC.TT*'))
            .then(function (list) {
                var t1 = false;
                var t2 = false;
                for(var i=0; i<list.length; ++i) {
                    var entry = list[i];
                    if (entry['Dsname'] === getDSN('NODEACC.TT1')) {
                        t1 = true;
                    }
                    if (entry['Dsname'] === getDSN('NODEACC.TT2')) {
                        t2 = true;
                    }
                }
                done();
                expect(t1).toBeTruthy();
                expect(t2).toBeTruthy();
            }).catch(function(err) {
                done(err);
            });
    });

    it('can delete MVS dataset T1 and T2', function(done) {
        _client.deleteDataset(getDSNWithQuotes('NODEACC.TT1'))
            .then(function () {
                // Do nothing.
            }).catch(function(err) {
                done(err);
            });
        _client.deleteDataset(getDSNWithQuotes('NODEACC.TT2'))
            .then(function () {
                // Do nothing.
            }).catch(function(err) {
                done(err);
            });
        _client.listDataset(getDSN('NODEACC.TT*'))
            .then(function (list) {
                var t1 = false;
                var t2 = false;
                for(var i=0; i<list.length; ++i) {
                    var entry = list[i];
                    if (entry['Dsname'] === getDSN('NODEACC.TT1')) {
                        t1 = true;
                    }
                    if (entry['Dsname'] === getDSN('NODEACC.TT2')) {
                        t2 = true;
                    }
                }
                done();
                expect(t1).toBeFalsy();
                expect(t2).toBeFalsy();
            }).catch(function(err) {
                done(err);
            });
    });

    // The file "/u/<username>/nodeacc/hello.txt" is required on USS.
    it('can list USS files', function(done) {
        _client.listDataset(getUSSPath('nodeacc/'))
            .then(function (list) {
                var t1 = false;
                for(var i=0; i<list.length; ++i) {
                    var entry = list[i];
                    if (entry.name === 'hello.txt') {
                        t1 = true;
                    }
                }
                done();
                expect(t1).toBeTruthy();
            }).catch(function(err) {
                done(err);
            });
    });    

    // The dataset "<USERNAME>.NODEACC.HELLO" is required on MVS.
    it('can get MVS dataset in ascii mode', function(done) {
        var text = 'HELLO                                                                   00000100\r\n';

        _client.getDataset(getDSN('NODEACC.HELLO'), 'ascii')
            .then(function(buffer) {
                expect(buffer.toString()).toBe(text);
                done();
            }).catch(function(err) {
                done(err);
            });
    });

    // The dataset "<USERNAME>.NODEACC.HELLO" is required on MVS.
    it('can get MVS dataset in ascii_strip_eol mode', function(done) {
        var text = 'HELLO                                                                   00000100';

        _client.getDataset(getDSN('NODEACC.HELLO'), 'ascii_strip_eol')
            .then(function(buffer) {
                expect(buffer.toString()).toBe(text);
                done();
            }).catch(function(err) {
                done(err);
            });
    });

    // The dataset "<USERNAME>.NODEACC.HELLO2" with the contents of "HELLO" is required on MVS.
    it('can get MVS dataset in ascii_no_trailing_blanks mode', function(done) {
        var text = 'HELLO\r\n';

        _client.getDataset(getDSN('NODEACC.HELLO2'), 'ascii_no_trailing_blanks')
            .then(function(buffer) {
                expect(buffer.toString()).toBe(text);
                done();
            }).catch(function(err) {
                done(err);
            });
    });

    // The dataset "<USERNAME>.NODEACC.HELLO2" with the contents of "HELLO" is required on MVS.
    it('can get MVS dataset in ascii mode', function(done) {
        var text = 'HELLO                                                                           \r\n';

        _client.getDataset(getDSN('NODEACC.HELLO2'), 'ascii')
            .then(function(buffer) {
                expect(buffer.toString()).toBe(text);
                done();
            }).catch(function(err) {
                done(err);
            });
    });

    // The VB dataset "<USERNAME>.NODEACC.VBHELLO" with the contents of "HELLO" is required on MVS.
    it('can get MVS dataset in ascii_rdw mode', function(done) {
        var bytes = [0,11,0,0,86,66,72,69,76,76,79,13,10];

        _client.getDataset(getDSN('NODEACC.VBHELLO'), 'ascii_rdw')
            .then(function(buffer) {
                expect(Array.from(buffer.values())).toEqual(bytes);
                done();
            }).catch(function(err) {
                done(err);
            });
    });

    // The VB dataset "<USERNAME>.NODEACC.VBHELLO" with the contents of "HELLO" is required on MVS.
    it('can get MVS dataset in binary_rdw mode', function(done) {
        var bytes = [0,11,0,0,229,194,200,197,211,211,214];

        _client.getDataset(getDSN('NODEACC.VBHELLO'), 'binary_rdw')
            .then(function(buffer) {
                expect(Array.from(buffer.values())).toEqual(bytes);
                done();
            }).catch(function(err) {
                done(err);
            });
    });

    it('can get MVS dataset in BINARY mode', function(done) {
        var text = 'c8c5d3d3d640404040404040404040404040404040404040404040404040404040404040404040404040404040404040404040404040404040404040404040404040404040404040f0f0f0f0f0f1f0f0';

        _client.getDataset(getDSN('NODEACC.HELLO'), 'binary')
            .then(function(buffer) {
                expect(buffer.toString('hex')).toBe(text);
                done();
            }).catch(function(err) {
                done(err);
            });
    });

    it('can get MVS dataset in ASCII mode as STREAM', function(done) {
        var text = 'HELLO                                                                   00000100\r\n';
        _client.getDataset(getDSN('NODEACC.HELLO'), 'ascii', true)
            .then(function(stream) {
                var chunks = [];
                stream.on('data', function (chunk) {
                    chunks.push(chunk);
                });
                stream.on('end', function () {
                    var buffer = Buffer.concat(chunks);
                    expect(buffer.toString()).toBe(text);
                    done();
                });
                stream.on('error', function (err) {
                    done(err);
                });
                stream.resume();
            }).catch(function(err) {
                done(err);
            });
    });

    it('can get USS file in ASCII mode', function(done) {
        var text = 'Hello\r\n';

        _client.getDataset(getUSSPath('nodeacc/hello.txt'), 'ascii')
            .then(function(buffer) {
                expect(buffer.toString()).toBe(text);
                done();
            }).catch(function(err) {
                done(err);
            });
    });

    it('can get USS file in BINARY mode', function(done) {
        var text = 'c88593939615';

        _client.getDataset(getUSSPath('nodeacc/hello.txt'), 'binary')
            .then(function(buffer) {
                expect(buffer.toString('hex')).toBe(text);
                done();
            }).catch(function(err) {
                done(err);
            });
    });

    it('can get USS file in ASCII_STRIP_EOL mode', function(done) {
        var text = 'Hello';

        _client.getDataset(getUSSPath('nodeacc/hello.txt'), 'ascii_strip_eol')
            .then(function(buffer) {
                expect(buffer.toString()).toBe(text);
                done();
            }).catch(function(err) {
                done(err);
            });
    });

    it('can get USS file in ascii_no_trailing_blanks mode', function(done) {
        var text = 'Hello\r\n';

        _client.getDataset(getUSSPath('nodeacc/hello.txt'),'ascii_no_trailing_blanks')
            .then(function(buffer) {
                expect(buffer.toString()).toBe(text);
                done();
            }).catch(function(err) {
                done(err);
            });
    });

    it('can get USS file in ASCII mode as STREAM', function(done) {
        var text = 'Hello\r\n';

        _client.getDataset(getUSSPath('nodeacc/hello.txt'), 'ascii', true)
            .then(function(stream) {
                var chunks = [];
                stream.on('data', function (chunk) {
                    chunks.push(chunk);
                });
                stream.on('end', function () {
                    var buffer = Buffer.concat(chunks);
                    expect(buffer.toString()).toBe(text);
                    done();
                });
                stream.on('error', function (err) {
                    deferred.reject(err);
                });
                stream.resume();
            }).catch(function(err) {
                done(err);
            });
    });

    it('can submit stat commands without argument correctly', function(done) {
        _client.stat().then(function(result) {
            expect(result).toContain('UMASK');
            done();
        });
    });

    it('can submit stat/site commands correctly', function(done) {
        _client.stat('SBSENDEOL').then(function(result) {
            expect(result).not.toContain(' LF ');
            _client.site('UMASK 007 SBSENDEOL=LF').then(function(text) {
                _client.stat('SBSENDEOL').then(function(result) {
                    expect(result).toContain(' LF ');
                    _client.stat('UMASK').then(function(result) {
                        expect(result).toContain('007');
                        done();
                    });
                });
            });
        });
    });

    it('can return proper error message with bad syntax site command', function(done) {
        _client.site('UMASK=007').then(function(text) {
            expect(text).toContain('Umask invalid syntax');
            done();
        });
    });

    function getUSSPath(path) {
        return `/u/${USERNAME.toLowerCase()}/${path}`;
    }
    
    function getDSN(name) {
        return USERNAME.toUpperCase() + '.' + name;
    }

    function getDSNWithQuotes(name) {
        return '\'' + USERNAME.toUpperCase() + '.' + name + '\'';
    }

    function HRECALL() {
        var jcl = fs.readFileSync(path.join(__dirname, '../lib/JCL/HRECALL.jcl'), 'utf8');
        jcl = jcl.replace('__MSGCLASS__', 'H');
        jcl = jcl.replace('__INPUT__', '\'ADCDA.TEST\'');
        return { jobName: 'HRECALL', jcl: jcl };
    }

    function COPY() {
        var jcl = fs.readFileSync(path.join(__dirname, '../lib/JCL/COPY.jcl'), 'utf8');
        jcl = jcl.replace('__MSGCLASS__', 'H');
        jcl = jcl.replace('__FROM__', '\'ADCDA.TESTPDS\'');
        jcl = jcl.replace('__TO__', '\'ADCDA.TESTPDS2\'');
        jcl = jcl.replace('__MEMBER__', 'A');
        return { jobName: 'COPY', jcl: jcl };
    }

    function ALLOC(dsn) {
        var jcl = fs.readFileSync(path.join(__dirname, '../lib/JCL/ALLOC.jcl'), 'utf8');
        jcl = jcl.replace('__MSGCLASS__', 'H');
        jcl = jcl.replace('__DSN__', dsn);
        jcl = jcl.replace('__SPACE__', '1,1');
        jcl = jcl.replace('__UNIT__', 'TRACK');
        jcl = jcl.replace('__BLKSIZE__', '1280');
        jcl = jcl.replace('__LRECL__', '80');
        jcl = jcl.replace('__DSORG__', 'PS');
        jcl = jcl.replace('__RECFM__', 'F,B');
        return { jobName: 'ALLOC', jcl: jcl };
    }
    
    function ALLOCPDS() {
        var jcl = fs.readFileSync(path.join(__dirname, '../lib/JCL/ALLOCPDS.jcl'), 'utf8');
        jcl = jcl.replace('__MSGCLASS__', 'H');
        jcl = jcl.replace('__DSN__', '\'ADCDA.TESTALLP\'');
        return { jobName: 'ALLOCPDS', jcl: jcl };
    }
    
    function submitJob(client, job) {
        var jcl = job.jcl.replace(/ADCDA/g, USERNAME);
        return client.submitJCL(jcl)
            .then(function (jobId) {
                console.log('Submitted ', job.jobName, jobId);
                var deferred = Q.defer();
                setTimeout(function() {
                    pollJCLJobStatus(deferred, client, job.jobName, jobId, MAX_QUERIES);
                }, QUERY_INTERVAL);
                return deferred.promise;
            });
    }

    function pollJCLJobStatus(deferred, client, jobName, jobId, timeOutCount) {
        if (timeOutCount === 0) {
            deferred.resolve(Client.RC_FAIL);
        }

        client.queryJob(jobName, jobId)
            .then(function(rc) {
                console.log(jobId, rc);
                if (rc === Client.RC_SUCCESS || rc === Client.RC_FAIL) {
                    deferred.resolve({ jobName: jobName, jobId: jobId, rc: rc} );
                } else {
                    setTimeout(function() {
                        pollJCLJobStatus(deferred, client, jobName, jobId, timeOutCount - 1);
                    }, QUERY_INTERVAL);
                }
            });
    }    
});    
    
