/****************************************************************************/
/*                                                                          */
/* Copyright (c) 2019 IBM Corp.                                             */
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
var stream = require('stream');
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

var rawJobList = [
    'JOBNAME  JOBID    OWNER    STATUS CLASS',
    'HISCONVT JOB17459 MIAOCX   OUTPUT A        RC=0000 6 spool files',
    'HISCONVT JOB17462 MIAOCX   ACTIVE A',
    'EZA2284I JOB00083 USER1 OUTPUT A ABEND=806 3 spool files',
    'EZA2284I JOB00082 USER1 OUTPUT A (JCL error) 3 spool files',
    'EZA2284I JOB00093 USER1 INPUT A -HELD-',
    'HISCONVT JOB17463 MIAOCX   held'
];


describe('Test cases for the object parameter of', function() {

    var client;
    var stubSite;
    var stubList;

    beforeEach(function() {
        client = new Client();
        if(!TEST_ZOS) {
            client.username = 'alice';
            sinon.stub(client.client, 'connect', function() {
                client.username = 'alice';
            });
            sinon.stub(client.client, 'ascii').callsArgWith(0, null);
            sinon.stub(client.client, 'binary').callsArgWith(0, null);
            stubList = sinon.stub(client.client, 'list').callsArgWith(0, null, rawJobList);
            sinon.stub(client.client, 'on', function(arg, callback) {
                callback(arg);
                return client.client;
            });
        }
        return client.connect({user: USERNAME, password: PASSWD, host: HOST});
    });

    beforeEach(function() {
        if(!TEST_ZOS) {
            stubSite = sinon.stub(client.client, 'site').callsArgWith(1, null);
        }
    });

    describe('listJobs()', function() {

        it('can list job with no parameter', function () {
            return client.listJobs().then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES JESJOBNAME=* JESOWNER=alice JESSTATUS=*');
            });
        });

        it('can list job with the string of job name', function () {
            return client.listJobs('jobA').then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES JESJOBNAME=jobA JESOWNER=alice JESSTATUS=*');
            });
        });

        it('can list job with the option object including jobName', function () {
            return client.listJobs({jobName: '*'}).then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES JESJOBNAME=* JESOWNER=alice JESSTATUS=*');
            });
        });

        it('can list job with the option object including jobName and owner', function () {
            return client.listJobs({jobName: '*', owner: 'bob'}).then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES JESJOBNAME=* JESOWNER=bob JESSTATUS=*');
            });
        });

        it('can list job with the option object including jobName, owner, and status', function () {
            return client.listJobs({jobName: '*', owner: 'bob', status: 'OUTPUT'}).then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES JESJOBNAME=* JESOWNER=bob JESSTATUS=OUTPUT');
            });
        });
    });

    describe('queryJob()', function() {

        it('can query job with the string of job name and job ID', function () {
            return client.queryJob('jobA', 'job001').then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES JESJOBNAME=jobA JESOWNER=alice JESSTATUS=* JESJOBID=job001');
            });
        });

        it('can query job with the option object including jobName, owner, and jobId', function () {
            return client.queryJob({jobName: '*', owner: 'bob', jobId: 'job001'}).then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES JESJOBNAME=* JESOWNER=bob JESSTATUS=* JESJOBID=job001');
            });
        });

        it('can query job with bad parameter', function () {
            try {
                sinon.spy(client.queryJob(999));
                sinon.assert.fail('Exception is not threw as expected');
            } catch(e) {
                expect(e.message).to.eq('The first parameter type of queryJob() should be string or object.');
            }
        });
    });

    describe('getJobStatus()', function() {

        beforeEach(function() {
            stubList && stubList.restore();
            stubList = sinon.stub(client.client, 'list').callsArgWith(1, null, rawJobList);
        })

        it('can get job status with the string of job ID', function () {
            return client.getJobStatus('job001').then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES SBSENDEOL=CRLF JESJOBNAME=* JESOWNER=alice');
                sinon.assert.calledWith(stubList, 'job001');
            });
        });

        it('can get job status with the string of job ID', function () {
            return client.getJobStatus({jobId: 'job001', owner: '*'}).then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES SBSENDEOL=CRLF JESJOBNAME=* JESOWNER=*');
                sinon.assert.calledWith(stubList, 'job001');
            });
        });

        it('can NOT get job status  with bad parameter', function () {
            try {
                sinon.spy(client.getJobStatus(999));
                sinon.assert.fail('Exception is not threw as expected');
            } catch(e) {
                expect(e.message).to.eq('The first parameter type of getJobStatus() should be string or object.');
            }
        });

        afterEach(function() {
            stubList && stubList.restore();
        });
    });

    describe('getJobLog()', function() {

        var getStub;

        beforeEach(function() {
            if(!TEST_ZOS) {
                var bufferStream = new stream.PassThrough();
                bufferStream.end(new Buffer('MINUTES EXECUTION TIME\n!! END OF JES SPOOL FILE !!AAA\n!! END OF JES SPOOL FILE !!'));
                getStub = sinon.stub(client.client, 'get').callsArgWith(1, null, bufferStream);
            }
        });

        it('can get job log with the string of undefined job name and job ID', function () {
            return client.getJobLog(undefined, 'job001').then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES SBSENDEOL=CRLF JESJOBNAME=* JESOWNER=alice');
                sinon.assert.calledWith(getStub, 'job001.x');
            })
        });

        it('can get job log with the string of undefined job name, job ID, and x', function () {
            return client.getJobLog(undefined, 'job001', 'x').then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES SBSENDEOL=CRLF JESJOBNAME=* JESOWNER=alice');
                sinon.assert.calledWith(getStub, 'job001.x');
            })
        });

        it('can get job log with the string of undefined job name, job ID, and file ID 1', function () {
            return client.getJobLog(undefined, 'job001', 1).then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES SBSENDEOL=CRLF JESJOBNAME=* JESOWNER=alice');
                sinon.assert.calledWith(getStub, 'job001.1');
            })
        });

        it('can get job log with the option object including job ID', function () {
            return client.getJobLog({jobId: 'job001'}).then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES SBSENDEOL=CRLF JESJOBNAME=* JESOWNER=alice');
                sinon.assert.calledWith(getStub, 'job001.x');
            })
        });

        it('can get job log with the option object including job name, job ID', function () {
            return client.getJobLog({jobName: 'jobA', jobId: 'job001'}).then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES SBSENDEOL=CRLF JESJOBNAME=jobA JESOWNER=alice');
                sinon.assert.calledWith(getStub, 'job001.x');
            })
        });

        it('can get job log with the option object including job name, job ID, and file ID x', function () {
            return client.getJobLog({jobName: 'jobA', jobId: 'job001', fileId: 'x'}).then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES SBSENDEOL=CRLF JESJOBNAME=jobA JESOWNER=alice');
                sinon.assert.calledWith(getStub, 'job001.x');
            })
        });

        it('can get job log with the option object including job name, job ID, and file ID 1', function () {
            return client.getJobLog({jobName: 'jobA', jobId: 'job001', fileId: '1'}).then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES SBSENDEOL=CRLF JESJOBNAME=jobA JESOWNER=alice');
                sinon.assert.calledWith(getStub, 'job001.1');
            })
        });

        it('can get job log with the option object including job name, job ID, and file ID x', function () {
            return client.getJobLog({jobName: 'jobA', jobId: 'job001', fileId: 'x', owner: '*'}).then(function () {
                sinon.assert.calledWith(stubSite, 'FILETYPE=JES SBSENDEOL=CRLF JESJOBNAME=jobA JESOWNER=*');
                sinon.assert.calledWith(getStub, 'job001.x');
            })
        });

        it('can NOT get job log with bad parameter', function () {
            try {
                sinon.spy(client.getJobLog(999));
                sinon.assert.fail('Exception is not threw as expected');
            } catch(e) {
                expect(e.message).to.eq('The first parameter type of getJobLog() should be string or object.');
            }
        });

        it('can NOT get job log with no job ID', function () {
            try {
                sinon.spy(client.getJobLog({}));
                sinon.assert.fail('Exception is not threw as expected');
            } catch(e) {
                expect(e.message).to.eq('The job ID is required by getJobLog().');
            }
        });

        afterEach(function() {
            getStub && getStub.restore();
        })
    });

    afterEach(function() {
        stubSite && stubSite.restore();
        stubList && stubList.restore();
    })

    afterEach(function () {
        client && client.close();
    })

});