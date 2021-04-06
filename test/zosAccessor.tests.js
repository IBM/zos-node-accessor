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

var sinon = require('sinon');
var stream = require('stream');
var Q = require('q');
var Client = require('../lib/zosAccessor');

var USERNAME = process.env.ZOS_FTP_USERNAME || 'ADCDA';
var PASSWD = process.env.ZOS_FTP_PASSWD || 'TEST';
var HOST = process.env.ZOS_FTP_HOST;
var PORT = process.env.ZOS_FTP_PORT;
var TEST_ZOS = !!HOST;

if(!TEST_ZOS) {
    console.info('Using a mocked z/OS FTP server');
}

var rawDatasetList, rawMemberList, rawUSSList, rawJobList;

describe('Test cases for z/OS node accessor', function() {
    var client;
    var uploadDSN = 'DELETE.ME';
    var site_stub;
    var bufferStream = new stream.PassThrough();

    beforeEach(function() {
        client = new Client();
        if(!TEST_ZOS) {
            sinon.stub(client.client, 'connect');
            sinon.stub(client.client, 'ascii').callsArgWith(0, null);
            sinon.stub(client.client, 'binary').callsArgWith(0, null);
            site_stub = sinon.stub(client.client, 'site').callsArgWith(1, null, bufferStream);
            sinon.stub(client.client, 'on', function(arg, callback) {
                callback(arg);
                return client.client;
            });
        }
        return client.connect({user: USERNAME, password: PASSWD, host: HOST});
    });

    beforeEach(function () {
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

        rawMemberList = [
            ' Name     VV.MM   Created       Changed      Size  Init   Mod   Id',
            'JVBR30    01.01 2018/09/07 2018/09/07 03:52    13    13     0 USER',
            'JVBR42    01.01 2018/09/07 2018/09/07 07:41    13    13     0 USER'
        ];

        rawJobList = [
            'JOBNAME  JOBID    OWNER    STATUS CLASS',
            'HISCONVT JOB17459 MIAOCX   OUTPUT A        RC=0000 6 spool files',
            'HISCONVT JOB17462 MIAOCX   ACTIVE A',
            'EZA2284I JOB00083 USER1    OUTPUT A ABEND=806 3 spool files',
            'EZA2284I JOB00082 USER1    OUTPUT A (JCL error) 3 spool files',
            'EZA2284I JOB00093 USER1    INPUT  A -HELD-',
            'HISCONVT JOB17463 MIAOCX   held'
        ];

        rawJCLMSGLG = [
            '1                     J E S 2  J O B  L O G  --  S Y S T E M  C E C 3  --  N O D E  X R F M C L          ',
            '0 ',
             '02.07.44 JOB07186 ---- FRIDAY,    12 JUL 2019 ----',
             '02.07.44 JOB07186  IRR010I  USERID USER001  IS ASSIGNED TO THIS JOB.',
             '02.07.44 JOB07186  ICH70001I USER001  LAST ACCESS AT 02:06:03 ON FRIDAY, JULY 12, 2019',
             '02.07.44 JOB07186  $HASP373 TESTJOB1 STARTED - INIT 10   - CLASS A        - SYS CEC3',
             '02.07.44 JOB07186  IEF403I TESTJOB1 - STARTED - TIME=02.07.44',
             '02.07.45 JOB07186  - ==============================================================================================================',
             '02.07.45 JOB07186  -                                    REGION        --- STEP TIMINGS ---                   ----PAGING COUNTS----',
             '02.07.45 JOB07186  - STEPNAME PROCSTEP PGMNAME     CC     USED      CPU TIME  ELAPSED TIME    EXCP     SERV  PAGE  SWAP   VIO SWAPS',
             '02.07.45 JOB07186  - STARNOTE          BPXBATCH    00     168K    0:00:00.04    0:00:00.89     185      554     0     0     0     0',
             '02.07.54 JOB07186  - TESTJOB1 JAVAJVM  JVMLDM76    00      56K    0:01:14.88    0:00:09.10   1149K    1494K     0     0     0     0',
             '02.07.54 JOB07186  - DELONERR          IDCAMS   FLUSH       0K    0:00:00.00    0:00:00.00       0        0     0     0     0     0',
             '02.07.54 JOB07186  - FAILNOTE          BPXBATCH FLUSH       0K    0:00:00.00    0:00:00.00       0        0     0     0     0     0',
             '02.07.55 JOB07186  - SUCCNOTE          BPXBATCH    00     168K    0:00:00.03    0:00:00.74     185      507     0     0     0     0',
             '02.07.55 JOB07186  IEF404I TESTJOB1 - ENDED - TIME=02.07.55',
             '02.07.55 JOB07186  - ==============================================================================================================',
             '02.07.55 JOB07186  - NAME-                     TOTALS: CPU TIME=   0:01:14.95  ELAPSED TIME=   0:00:10.73 SERVICE UNITS=  1495K',
             '02.07.55 JOB07186  - ==============================================================================================================',
             '02.07.55 JOB07186  $HASP395 TESTJOB1 ENDED - RC=0008',
            '0------ JES2 JOB STATISTICS ------',
            '-  12 JUL 2019 JOB EXECUTION DATE',
            '-           90 CARDS READ',
            '-          833 SYSOUT PRINT RECORDS',
            '-            0 SYSOUT PUNCH RECORDS',
            '-           61 SYSOUT SPOOL KBYTES',
            '-         0.17 MINUTES EXECUTION TIME',
        ];
    });

    it('can upload to remote dataset', function() {
        if(!TEST_ZOS) {
            var stub = sinon.stub(client.client, 'put').callsArgWith(2, null);
        }
        return client.uploadDataset('just delete me', uploadDSN, 'ascii', {'LRECL': 80, 'RECFM': 'FB', 'BLKSIZE': 320}).finally(function () {
            stub && stub.restore();
        });
    });

    it('can list root folder of USS', function() {
        if(!TEST_ZOS) {
            var stub = sinon.stub(client.client, 'list').callsArgWith(1, null, rawUSSList);
        }
        return client.listDataset('/').then(function (list) {
            expect(list.length).toBeGreaterThan(1);
        }).finally(function () {
            stub && stub.restore();
        });
    });

    it('can list root folder of data set', function() {
        if(!TEST_ZOS) {
            var stub = sinon.stub(client.client, 'list').callsArgWith(1, null, rawDatasetList);
        }
        return client.listDataset(USERNAME+'.*').then(function (list) {
            expect(list.length).toBeGreaterThan(1);
            var foundUploaded = false;
            for(var i=0; i<list.length; ++i) {
                var entry = list[i];
                if(entry.Dsname && entry.Dsname.endsWith(uploadDSN)) {
                    uploadDSN = entry.Dsname;
                    foundUploaded = true;
                }
            }
            expect(foundUploaded).toBeTruthy();
        }).finally(function () {
            stub && stub.restore();
        });
    });

    it('can parse MVS data set list correctly', function() {
        var datasetList = client.parseMVSDataSets(rawDatasetList);
        expect(datasetList.length).toBe(45);
        expect(datasetList.filter(function(e){return e.hasOwnProperty('Ext')}).length)
            .toBe(44);
    });

    it('can parse PDS member list correctly', function() {
        var datasetList = client.parsePDSMembers(rawMemberList);
        expect(datasetList.length).toBe(2);
        expect(datasetList[0]['Changed']).toBe('2018/09/07 03:52');
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
        expect(typeof datasetList).toBe('object');
        expect(datasetList.length).toBe(4);

        // Verify whether Ext can be separated from Used
        expect(datasetList[1]['Volume']).toBe('XRFS95');
        expect(datasetList[1]['Unit']).toBe('3390');
        expect(datasetList[1]['Ext']).toBe('3');
        expect(datasetList[1]['Used']).toBe('13875');
        expect(datasetList[1]['Recfm']).toBe('FB');
        expect(datasetList[1]['Lrecl']).toBe('1024');
        expect(datasetList[1]['BlkSz']).toBe('27648');
        expect(datasetList[1]['Dsorg']).toBe('PS');
        expect(datasetList[1]['Dsname']).toBe('USERHLQI.T2.HISPAXZ');


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
        'UTHELLO JOB12345  USER     OUTPUT A        RC=0000\n' +
        '--------\n' +
        '         ID  STEPNAME PROCSTEP C DDNAME   BYTE-COUNT \n' +
        '         001 JES2              K JESMSGLG      1206 \n' +
        '         002 JES2              K JESJCL        3134 \n' +
        '         003 JES2              K JESYSMSG      2480 \n' +
        '         004 JAVA     JAVAJVM  K SYSOUT         801 \n' +
        '         005 JAVA     JAVAJVM  K STDOUT       22258 \n' +
        '5 spool files ';

    var jobStatusOfAbend = '' +
        'JOBNAME  JOBID    OWNER    STATUS CLASS\n' +
        'HELLO    TSU18242 USER     OUTPUT TSU      ABEND=622 \n' +
        '--------\n' +
        '         ID  STEPNAME PROCSTEP C DDNAME   BYTE-COUNT  \n' +
        '         001 PROC01   PROC01   B SYS00010       192 \n' +
        '1 spool files ';

    var jobStatusOfJCLError = '' +
        'JOBNAME  JOBID    OWNER    STATUS CLASS\n' +
        'HELLO    JOB00256 USER     OUTPUT A        (JCL error) \n' +
        '--------\n' +
        '         ID  STEPNAME PROCSTEP C DDNAME   BYTE-COUNT  \n' +
        '         001 JES2        N/A   A JESMSGLG      1590 \n' +
        '         002 JES2        N/A   A JESJCL         627 \n' +
        '         003 JES2        N/A   A JESYSMSG      1188 \n' +
        '3 spool files ';

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
            jobStatusResp = jobStatusResp.replace('JOB12345', submittedJobId);
            expect(jobId).toMatch(/^\w+\d+$/);
        }).finally(function () {
            stub && stub.restore();
        });
    });

    it('can get job status of RC=0', function(done) {
        if(!TEST_ZOS) {
            var listStub = sinon.stub(client.client, 'list').callsArgWith(1, null, jobStatusResp.split('\n'));
        }
        // Add a delay here so the submitted job can be queried
        setTimeout(function() {
            client.getJobStatus(submittedJobId).then(function (status) {
                expect(status.spoolFiles.length).toBeGreaterThan(0);
                expect(status.rc).toBe(0);
                expect(status.retcode).toBe('RC 0000');
                expect(status.jobid).toEqual(submittedJobId);
                done();
            }).catch(function(err) {
                done(err);
            }).finally(function () {
                listStub && listStub.restore();
            })
        }, TEST_ZOS ? 5000 : 0);
    });

    it('can get job status of RC=ABEND', function(done) {
        if(!TEST_ZOS) {
            var listStub = sinon.stub(client.client, 'list').callsArgWith(1, null, jobStatusOfAbend.split('\n'));
        }
        // Add a delay here so the submitted job can be queried
        setTimeout(function() {
            client.getJobStatus('TSU18242').then(function (status) {
                expect(status.spoolFiles.length).toBeGreaterThan(0);
                expect(status.rc).toBe('ABEND=622');
                expect(status.retcode).toBe('ABEND 622');
                expect(status.jobid).toEqual('TSU18242');
                done();
            }).catch(function(err) {
                done(err);
            }).finally(function () {
                listStub && listStub.restore();
            })
        }, TEST_ZOS ? 5000 : 0);
    });

    it('can get job status of RC=JCL Error', function(done) {
        if(!TEST_ZOS) {
            var listStub = sinon.stub(client.client, 'list').callsArgWith(1, null, jobStatusOfJCLError.split('\n'));
        }
        // Add a delay here so the submitted job can be queried
        setTimeout(function() {
            client.getJobStatus('JOB00256').then(function (status) {
                expect(status.spoolFiles.length).toBeGreaterThan(0);
                expect(status.rc).toBe('(JCL error)');
                expect(status.retcode).toBe('JCL ERROR');
                expect(status.jobid).toEqual('JOB00256');
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
            var bufferStream = new stream.PassThrough();
            bufferStream.end(new Buffer('MINUTES EXECUTION TIME\n!! END OF JES SPOOL FILE !!AAA\n!! END OF JES SPOOL FILE !!'));
            var getStub = sinon.stub(client.client, 'get').callsArgWith(1, null, bufferStream);
            var listStub = sinon.stub(client.client, 'list').callsArgWith(1, null, jobStatusResp.split('\n'));
        }
        // Add a delay here so the submitted job can be queried
        setTimeout(function() {
            client.getJobLog('UTHELLO', submittedJobId, 'metaInfo').then(function (log) {
            getStub && expect(getStub.calledWith(submittedJobId+'.x')).toBeTruthy();
            expect(log.length).toBeGreaterThan(0);
            if (TEST_ZOS) {
                expect(log[0].content).to.be.a('string');
                expect(log[0].ddname).to.be.a('string');
                expect(log[0].stepname).to.be.a('string');
            } else {
                expect(log[0].content).toEqual('MINUTES EXECUTION TIME');
                expect(log[0].ddname).toEqual('JESMSGLG');
                expect(log[0].stepname).toEqual('JES2');
                expect(log[0].byteCount).toEqual(1206);
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
        var stub = sinon.stub(client.client, 'list').callsArgWith(0, null, rawJobList);
        return Q.all([
            client.queryJob('any_name', 'JOB17459').then(function (status) {
                expect(status).toBe(Client.RC_SUCCESS);
            }),
            client.queryJob('any_name', 'JOB17462').then(function (status) {
                expect(status).toBe(Client.RC_ACTIVE);
            }),
            client.queryJob('any_name', 'JOB00083').then(function (status) {
                expect(status).toBe(Client.RC_FAIL);
            }),
            client.queryJob('any_name', 'JOB00082').then(function (status) {
                expect(status).toBe(Client.RC_FAIL);
            }),
            client.queryJob('any_name', 'JOB00093').then(function (status) {
                expect(status).toBe(Client.RC_WAITING);
            }),
            client.queryJob('any_name', 'JOB17463').then(function (status) {
                expect(status).toBe(Client.RC_FAIL);
            }),
            client.queryJob('any_name', 'JOB_NON_EXIST').then(function (status) {
                expect(status).toBe(Client.RC_NOT_FOUND);
            })
        ]).finally(function () {
            stub && stub.restore();
        });
    });

    it('can list job on condition', function () {
        if(!TEST_ZOS) {
            var stub = sinon.stub(client.client, 'list').callsArgWith(0, null, rawJobList);
        }
        return client.listJobs({jobName: '*'}).then(function (jobList) {
            expect(jobList.length).toBeGreaterThan(1);
        }).finally(function () {
            stub && stub.restore();
        });
    });

    it('can read correct RC code from JESMSGLG', function() {
        if(!TEST_ZOS) {
            var listStub = sinon.stub(client.client, 'list').callsArgWith(1, null, jobStatusResp.split('\n'));
            var bufferStream = new stream.PassThrough();
            bufferStream.end(new Buffer(rawJCLMSGLG.join('\n')));
            var getStub = sinon.stub(client.client, 'get').callsArgWith(1, null, bufferStream);
        }
        return client.getRCFromJESMSGLG({jobName: 'jobName', jobId: 'jobId'}).then(function (rc) {
            expect(rc).toBe(8);
        }).finally(function () {
            listStub && listStub.restore();
            getStub && getStub.restore();
        });
    });

    it('can download variable length dataset with RDW mode', function() {

        if(!TEST_ZOS) {
            var bufferStream = new stream.PassThrough();
            var stub= sinon.stub(client.client, 'get').callsArgWith(1, null, bufferStream);
        return client.getDataset(uploadDSN, 'binary_rdw', true).then(function () {
            site_stub && expect(site_stub.calledWithMatch(/.*rdw.*/)).toBeTruthy();
        }).finally(function () {
            stub && stub.restore();
            site_stub && site_stub.restore();
        });}
    });

    afterEach(function () {
        client && client.close();
    })
});
