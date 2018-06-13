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

var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');
var sinon = require('sinon');
var Q = require('q');
var Client = require('../lib/zosAccessor');

var USERNAME = process.env.ZOS_FTP_USERNAME || 'ADCDA';
var PASSWD = process.env.ZOS_FTP_PASSWD || 'TEST';
var HOST = process.env.ZOS_FTP_HOST;
var PORT = process.env.ZOS_FTP_PORT;
var TEST_ZOS = !!HOST;

if(!TEST_ZOS) {
    console.error('Using a mocked z/OS FTP server');
}

var rawDatasetList, rawUSSList;

describe('Test cases for z/OS node accessor', function() {
    this.timeout(15000);
    var client;
    var uploadDSN = 'DELETE.ME';

    before('should connect successfully', function() {
        client = new Client();
        if(!TEST_ZOS) {
            sinon.stub(client.client, 'connect');
            sinon.stub(client.client, 'ascii').callsArgWith(0, null);
            sinon.stub(client.client, 'binary').callsArgWith(0, null);
            sinon.stub(client.client, 'site').callsArgWith(1, null);
            sinon.stub(client.client, 'on', function(arg, callback) {
                callback(arg);
                return client.client;
            }); 
        }
        return client.connect({user: USERNAME, password: PASSWD, host: HOST});
    });

    beforeEach('set fixture values', function () {
        rawUSSList = [
            'total 554',
            'lrwxrwxrwx     1 CLASGEN  GRP2611        9 Jul 13 19:13 $SYSNAME -> $SYSNAME/',
            'lrwxrwxrwx     1 CLASGEN  GRP2611        9 Jul 13 19:13 $VERSION -> $VERSION/',
            'drwxr-xr-x    10 CLASGEN  DEFLT1      8192 Jul 13 18:52 CEC3',
            '-rwx------     1 CLASGEN  GRP2611     1749 Aug 25  2004 DetailMerge'
        ];

        rawDatasetList = [
            'Volume Unit    Referred Ext Used Recfm Lrecl BlkSz Dsorg Dsname',
            'F1DBAR 3390   2016/12/19  3   19  FB      80  3120  PO  CB12V51.CNTL',
            'F1SYS1 3390   2015/11/09  1   13  FB      80 32720  PO  CB12V51.DBRMLIB',
            'F1DBAR 3390   2016/12/19  1    2  FB      80  3120  PO  CB12V51.EXEC',
            'F1SYS1 3390   2016/12/19  1   75  U     6144  6144  PO  CB12V51.LOAD',
            'F1SYS1 3390   2015/11/09  1   75  U     6144  6144  PO  CB12V51.LOAD0',
            'F1SYS1 3390   **NONE**    1  300  VB   27994 27998  PS  CB12V51.LOG',
            'F1DBAR 3390   2015/11/09  1   13  FB      80 32720  PO  CB12V51.MAPCOPY',
            'F1DBAR 3390   **NONE**    1   13  FB      80 32720  PO  CB12V51.MSGTXT',
            'F1DBAR 3390   2015/11/09  1   33  FB      80  3120  PO  CB12V51.SOURCE',
            'F1DBAR 3390   2015/11/09  1   68  FB      80  3120  PO  CB12V51.WSIM',
            'F1DBAR 3390   2016/01/25  7    7  FB      80  3120  PS  CNTL.XMIT',
            '                                                   VSAM DDIR',
            'F1SYS1 3390                                        VSAM DDIR.D',
            'F1SYS1 3390                                        VSAM DDIR.I',
            'F1DBAR 3390   2015/11/09  1    1  FB      80  3120  PS  EXEC.XMIT',
            'F1SYS1 3390   **NONE**    1    1  FB     133  1330  PS  HCD.MSGLOG',
            'F1SYS1 3390   **NONE**    1    1  FB      80  1600  PS  HCD.TERM',
            'F1SYS1 3390   **NONE**    1    3  FB      80  6160  PS  HCD.TRACE',
            'F1SYS1 3390   2017/02/27  2   12  FB      80  3120  PO  ISPF.ISPPROF',
            'F1SYS1 3390   2017/02/27  1    1  VB     256  6233  PS  ' + uploadDSN,
            'F1DBAR 3390   2015/11/09  1    1  FB      80  3120  PS  KSDSCUST',
            'F1SYS1 3390   2015/12/17  1    1  FB      80  3120  PS  KSDSPOLY',
            'F1SYS1 3390   2016/12/19  1   14  FB      80  3120  PO  MOUNT',
            'F1DBAR 3390   2016/01/17  1   85  FB      80  3120  PS  PATCH',
            'F1DBAR 3390   2016/01/18  1   40  FB      80  3120  PO  RMFZV2R1.ISPTABLE',
            'F1DBAR 3390   2017/02/27  1  795  FB      80  6160  PO  SMF.CNTL',
            'F1SYS1 3390   2017/02/27  1    1  FB      80   800  PS  SMFR113A',
            'F1SYS1 3390   2017/02/24  1   15  U    27998 27998  PS  SMF0224.DUMP',
            'F1SYS1 3390   2017/02/24  1   75  FB    1024 27648  PS  SMF0224.DUMP.TERSE',
            'F1SYS1 3390   2017/02/23  5    5  VB     256  6233  PS  SMF1',
            'F1SYS1 3390   2016/01/17  1    1  FB      80  3120  PS  SMPAPPLY',
            'F1DBAR 3390   2016/01/21  1    1  FB      80  3120  PS  SMPRECVR',
            'F1SYS1 3390   2016/01/21  1    1  FB      80  3120  PS  SMPUCLN',
            'F1SYS1 3390   2015/11/09  1   22  FB      80  3120  PS  SOURCE.XMIT',
            'F1SYS1 3390   2015/11/30  3   23  FB     132 27984  PS  SRCHDSL.LIST',
            'F1SYS1 3390   2017/02/19  1    1  FBA     80  3120  PS  SYSCMD',
            'F1SYS1 3390   2017/02/19  1    1  FBA     80  3120  PS  SYSCMD2',
            'F1SYS1 3390   2017/02/19  1    1  FBA     80  3120  PS  SYSCMD3',
            'F1SYS1 3390   2017/02/19  1    1  FB      80 27920  PS  S0W1.ISPVCALL.TRACE',
            'F1SYS1 3390   2015/12/14  1    9  VA     125   129  PS  S0W1.SPFLOG1.LIST',
            'F1SYS1 3390   2017/02/27  1    9  VA     125   129  PS  S0W1.SPFLOG2.LIST',
            'F1SYS1 3390   2017/02/24  1    1  FB      80   800  PS  S0W1.SPFTEMP0.CNTL',
            'F1DBAR 3390   2017/02/24  1  750  VB     100 32756  PO  TEST.JCL',
            'F1DBAR 3390   2015/11/09  1   49  FB      80  3120  PS  WSIM.XMIT',
            'Migrated                                                CPPOBJS.OBJ',
            '250 List completed successfully.'
        ];
    });

    it('can upload to remote dataset', function() {
        if(!TEST_ZOS) {
            var stub = sinon.stub(client.client, 'put').callsArgWith(2, null);
        }
        return client.uploadDataset('just delete me', uploadDSN).finally(function () {
            stub && stub.restore();
        });
    });

    it('can list root folder of USS', function() {
        if(!TEST_ZOS) {
            var stub = sinon.stub(client.client, 'list').callsArgWith(1, null, rawUSSList);
        }
        return client.listDataset('/').then(function (list) {
            expect(list).to.be.an('array');
            expect(list.length).to.be.above(1);
        }).finally(function () {
            stub && stub.restore();
        });
    });

    it('can list root folder of data set', function() {
        if(!TEST_ZOS) {
            var stub = sinon.stub(client.client, 'list').callsArgWith(1, null, rawDatasetList);
        }
        return client.listDataset(USERNAME+'.*').then(function (list) {
            expect(list).to.be.an('array');
            expect(list.length).to.be.above(1);
            var foundUploaded = false;
            for(var i=0; i<list.length; ++i) {
                var entry = list[i];
                if(entry.Dsname && entry.Dsname.endsWith(uploadDSN)) {
                    uploadDSN = entry.Dsname;
                    foundUploaded = true;
                }
            }
            expect(foundUploaded).to.be.true;
        }).finally(function () {
            stub && stub.restore();
        });
    });

    it('can parse MVS data set list correctly', function() {
        var datasetList = client.parseMVSDataSets(rawDatasetList);
        expect(datasetList).to.be.an('array');
        expect(datasetList.length).to.be.equal(45);
        expect(datasetList.filter(function(e){return e.hasOwnProperty('Ext')}).length)
            .to.be.equal(44);
    });

    it('can parse MVS data set list without space padding correctly', function() {
        var rawDatasetList = [
            'Volume Unit    Referred Ext Used Recfm Lrecl BlkSz Dsorg Dsname',
            'XRFS79 3390   2017/08/04  1 4080  FB    1024 27648  PS  \'USERHLQI.T1.HISPAXZ\'',
            'XRFS95 3390   2017/08/04  313875  FB    1024 27648  PS  \'USERHLQI.T2.HISPAXZ\'',
            'XRFS61 3390   2017/08/04  1 4500  FB    1024 27648  PS  \'USERHLQI.T3.HISPAXZ\'',
            'XRFS67 3390   2017/08/04  314760  FB    1024 27648  PS  \'USERHLQI.T4.HISPAXZ\''
        ];
        var datasetList = client.parseMVSDataSets(rawDatasetList);
        expect(datasetList).to.be.an('array');
        expect(datasetList.length).to.be.equal(4);

        // Verify whether Ext can be separated from Used
        expect(datasetList[1]['Volume']).to.be.equal('XRFS95');
        expect(datasetList[1]['Unit']).to.be.equal('3390');
        expect(datasetList[1]['Ext']).to.be.equal('3');
        expect(datasetList[1]['Used']).to.be.equal('13875');
        expect(datasetList[1]['Recfm']).to.be.equal('FB');
        expect(datasetList[1]['Lrecl']).to.be.equal('1024');
        expect(datasetList[1]['BlkSz']).to.be.equal('27648');
        expect(datasetList[1]['Dsorg']).to.be.equal('PS');
        expect(datasetList[1]['Dsname']).to.be.equal('USERHLQI.T2.HISPAXZ');


    });

    it('can rename dataset', function() {
        if(!TEST_ZOS) {
            var stub = sinon.stub(client.client, 'rename').callsArgWith(2, null);
        }
        return client.rename(uploadDSN, uploadDSN + 'rename').then(function() {
            return client.rename(uploadDSN + 'rename', uploadDSN);
        }).finally(function () {
            stub && stub.restore();
        });
    });

    it('can delete dataset', function() {
        if(!TEST_ZOS) {
            var stub = sinon.stub(client.client, 'delete').callsArgWith(1, null);
        }
        return client.deleteDataset(uploadDSN).finally(function () {
            stub && stub.restore();
        });
    });

    var submittedJobId,
        jobStatusResp = '' +
        'JOBNAME  JOBID    OWNER    STATUS CLASS\n' +
        'UTHELLO __JOB_ID__ VPADEV   OUTPUT A        RC=0000\n' +
        '--------\n' +
        '       ID  STEPNAME PROCSTEP C DDNAME   BYTE-COUNT\n' +
        '       001 JES2        N/A   H JESMSGLG      1584\n' +
        '1 spool files';
    it('can submit JCL', function() {
        if(!TEST_ZOS) {
            var stub = sinon.stub(client.client, 'put', function (jcl, path, cb) {
                (function (err, text, code) {
                    cb();
                })(null, 'It is known to JES as JOB12345\n', 520);
            });
        }
        var helloJCL = "//UTHELLO JOB (999,POK),'METAL',CLASS=A,MSGCLASS=H,NOTIFY=&SYSUID\r\n//STEP0001 EXEC PGM=IEBGENER\r\n//SYSIN    DD DUMMY\r\n//SYSPRINT DD SYSOUT=*\r\n//SYSUT1   DD *\r\nHELLO, WORLD\r\n/*\r\n//SYSUT2   DD SYSOUT=*\r\n//"
        return client.submitJCL(helloJCL).then(function (jobId) {
            submittedJobId = jobId;
            jobStatusResp = jobStatusResp.replace('__JOB_ID__', submittedJobId);
            expect(jobId).to.match(/^\w+\d+$/);
        }).finally(function () {
            stub && stub.restore();
        });
    });

    it('can get job status', function(done) {
        if(!TEST_ZOS) {
            var listStub = sinon.stub(client.client, 'list').callsArgWith(1, null, jobStatusResp.split('\n'));
        }
        // Add a delay here so the submitted job can be queried
        setTimeout(function() {
            client.getJobStatus(submittedJobId).then(function (status) {
                expect(status.spoolFiles.length).to.be.above(0);
                expect(status.rc).to.be.equal(0);
                expect(status.jobid).to.equal(submittedJobId);
                done();
            }).catch(function(err) {
                done(err);
            }).finally(function () {
                listStub && listStub.restore();
            })
        }, TEST_ZOS ? 5000 : 0);
    });

    it('can get job log', function(done) {
        if(!TEST_ZOS) {
            var stream = require('stream');
            var bufferStream = new stream.PassThrough();
            bufferStream.end(new Buffer('MINUTES EXECUTION TIME\n!! END OF JES SPOOL FILE !!'));
            var getStub = sinon.stub(client.client, 'get').callsArgWith(1, null, bufferStream);
            var listStub = sinon.stub(client.client, 'list').callsArgWith(1, null, jobStatusResp.split('\n'));
        }
        // Add a delay here so the submitted job can be queried
        setTimeout(function() {
            client.getJobLog('UTHELLO', submittedJobId, 'metaInfo').then(function (log) {
            getStub && expect(getStub.calledWith(submittedJobId+'.x')).to.be.true;
            expect(log.length).to.be.above(0);
            if (TEST_ZOS) {
                expect(log[0].content).to.be.a('string');
                expect(log[0].ddname).to.be.a('string');
                expect(log[0].stepname).to.be.a('string');
            } else {
                expect(log[0].content).to.equal('MINUTES EXECUTION TIME');
                expect(log[0].ddname).to.equal('JESMSGLG');
                expect(log[0].stepname).to.equal('JES2');
                expect(log[0].byteCount).to.equal(1584);
            }
            done();
        }).catch(function(err) {
            done(err);
        }).finally(function () {
            getStub && getStub.restore();
            listStub && listStub.restore();
        })
        }, TEST_ZOS ? 5000 : 0);
    });

    it('can parse job list', function () {
        var stub = sinon.stub(client, 'listJobs', function() {
            return Q.resolve([
                'JOBNAME  JOBID    OWNER    STATUS CLASS',
                'HISCONVT JOB17459 MIAOCX   OUTPUT A        RC=0000 6 spool files',
                'HISCONVT JOB17462 MIAOCX   ACTIVE A',
                'EZA2284I JOB00083 USER1 OUTPUT A ABEND=806 3 spool files',
                'EZA2284I JOB00082 USER1 OUTPUT A (JCL error) 3 spool files',
                'EZA2284I JOB00093 USER1 INPUT A -HELD-',
                'HISCONVT JOB17463 MIAOCX   held'
            ]);
        });
        return Q.all([
            client.queryJob('any_name', 'JOB17459').then(function (status) {
                expect(status).to.be.equal(Client.RC_SUCCESS);
            }),
            client.queryJob('any_name', 'JOB17462').then(function (status) {
                expect(status).to.be.equal(Client.RC_ACTIVE);
            }),
            client.queryJob('any_name', 'JOB00083').then(function (status) {
                expect(status).to.be.equal(Client.RC_FAIL);
            }),
            client.queryJob('any_name', 'JOB00082').then(function (status) {
                expect(status).to.be.equal(Client.RC_FAIL);
            }),
            client.queryJob('any_name', 'JOB00093').then(function (status) {
                expect(status).to.be.equal(Client.RC_WAITING);
            }),
            client.queryJob('any_name', 'JOB17463').then(function (status) {
                expect(status).to.be.equal(Client.RC_FAIL);
            }),
            client.queryJob('any_name', 'JOB_NON_EXIST').then(function (status) {
                expect(status).to.be.equal(Client.RC_NOT_FOUND);
            })
        ]).finally(function () {
            stub && stub.restore();
        });
    });

    after(function () {
        client && client.close();
    })
});
