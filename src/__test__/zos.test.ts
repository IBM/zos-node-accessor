/****************************************************************************/
/*                                                                          */
/* Copyright (c) 2017, 2020 IBM Corp.                                       */
/* All rights reserved. This program and the accompanying materials         */
/* are made available under the terms of the Eclipse Public License v1.0    */
/* which accompanies this distribution, and is available at                 */
/* http://www.eclipse.org/legal/epl-v10.html                                */
/*                                                                          */
/* Contributors:                                                            */
/*  IBM Corp. - initial API and implementation                              */
/*                                                                          */
/****************************************************************************/

import * as fs from 'fs';
import * as path from 'path';
import * as Q from 'q';

import { JobStatusResult, ZosAccessor } from '../zosAccessor';
import { connectFTPServer } from './testUtils';

const MAX_QUERIES = 10;           // Query 10 times at most
const QUERY_INTERVAL = 2000;      // 2 seconds

let settingsFilePath = '/build/zos-node-accessor/customSettings.json'; // For running on Jenkins server
if (!fs.existsSync(settingsFilePath)) {
    settingsFilePath = path.join(__dirname, '../../resources/customSettings.json');
    if (!fs.existsSync(settingsFilePath)) {
        throw new Error('The settings file, customSettings.json, is not found.');
    }
}
const settings = JSON.parse(fs.readFileSync(settingsFilePath).toString());

const USERNAME = settings.username.toUpperCase();
const PASSWD = settings.password;
const HOST = settings.host;
const PORT = settings.port;

interface JobNameAndJCL {
    jobName: string;
    jcl: string;
}

/**
 * This integreation test suite allocates two MVS datasets, take the following actions before run it.
 *
 * 1) Delete <USERNAME>.NODEACC.TT1
 * 2) Delete <USERNAME>.NODEACC.TT2
 */
describe('Integration test cases for z/OS node accessor', () => {
    jest.setTimeout(60000);
    let accessor: ZosAccessor;

    beforeEach(async () => {
        accessor = await connectFTPServer();
    });

    afterEach(async () => {
        if (accessor) {
            accessor.close();
        }
    });

    function getDSN(name: string): string {
        return USERNAME.toUpperCase() + '.' + name;
    }

    function getDSNWithQuotes(name: string): string {
        return '\'' + USERNAME.toUpperCase() + '.' + name + '\'';
    }

    function ALLOC(dsn: string): JobNameAndJCL {
        let jcl = fs.readFileSync(path.join(__dirname, '../JCL/ALLOC.jcl'), 'utf8');
        jcl = jcl.replace('__MSGCLASS__', 'H');
        jcl = jcl.replace('__DSN__', dsn);
        jcl = jcl.replace('__SPACE__', '1,1');
        jcl = jcl.replace('__UNIT__', 'TRACK');
        jcl = jcl.replace('__BLKSIZE__', '1280');
        jcl = jcl.replace('__LRECL__', '80');
        jcl = jcl.replace('__DSORG__', 'PS');
        jcl = jcl.replace('__RECFM__', 'F,B');
        return { jobName: 'ALLOC', jcl };
    }

    function allocateDataset(dsn: string, done: jest.DoneCallback): void {
        const job = ALLOC(dsn);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        submitJob(accessor, job)
            .then((result: any) => {
                done();
                expect(result.rc).toBe(JobStatusResult.SUCCESS);
            }).catch((err: Error) => {
                done(err);
            });
    }

    it('can allocate MVS dataset T1 via JCL', (done) => {
        const dsn = getDSNWithQuotes('NODEACC.TT1');
        accessor.deleteDataset(dsn)
            .then(() => {
                allocateDataset(dsn, done);
            }).catch((err: Error) => {
                allocateDataset(dsn, done);
            });
    });

    it('can allocate MVS dataset T2 via JCL', (done) => {
        const dsn = getDSNWithQuotes('NODEACC.TT2');
        accessor.deleteDataset(dsn)
            .then(() => {
                allocateDataset(dsn, done);
            }).catch((err: Error) => {
                allocateDataset(dsn, done);
            });
    });

    it('can delete MVS dataset T1 and T2', (done) => {
        accessor.deleteDataset(getDSNWithQuotes('NODEACC.TT1'))
            .then(() => {
                // Do nothing.
            }).catch((err: Error) => {
                done(err);
            });
        accessor.deleteDataset(getDSNWithQuotes('NODEACC.TT2'))
            .then(() => {
                // Do nothing.
            }).catch((err: Error) => {
                done(err);
            });
        accessor.listDatasets(getDSN('NODEACC.TT*'))
            .then((list) => {
                let t1 = false;
                let t2 = false;
                for (const entry of list) {
                    if (entry.name === getDSN('NODEACC.TT1')) {
                        t1 = true;
                    }
                    if (entry.name === getDSN('NODEACC.TT2')) {
                        t2 = true;
                    }
                }
                done();
                expect(t1).toBeFalsy();
                expect(t2).toBeFalsy();
            }).catch((err) => {
                done(err);
            });
    });

    function HRECALL(): JobNameAndJCL {
        let jcl = fs.readFileSync(path.join(__dirname, '../lib/JCL/HRECALL.jcl'), 'utf8');
        jcl = jcl.replace('__MSGCLASS__', 'H');
        jcl = jcl.replace('__INPUT__', '\'ADCDA.TEST\'');
        return { jobName: 'HRECALL', jcl };
    }

    function COPY(): JobNameAndJCL {
        let jcl = fs.readFileSync(path.join(__dirname, '../lib/JCL/COPY.jcl'), 'utf8');
        jcl = jcl.replace('__MSGCLASS__', 'H');
        jcl = jcl.replace('__FROM__', '\'ADCDA.TESTPDS\'');
        jcl = jcl.replace('__TO__', '\'ADCDA.TESTPDS2\'');
        jcl = jcl.replace('__MEMBER__', 'A');
        return { jobName: 'COPY', jcl };
    }

    function ALLOCPDS(): JobNameAndJCL {
        let jcl = fs.readFileSync(path.join(__dirname, '../lib/JCL/ALLOCPDS.jcl'), 'utf8');
        jcl = jcl.replace('__MSGCLASS__', 'H');
        jcl = jcl.replace('__DSN__', '\'ADCDA.TESTALLP\'');
        return { jobName: 'ALLOCPDS', jcl };
    }

    async function submitJob(client: ZosAccessor, job: JobNameAndJCL) {
        const jcl = job.jcl.replace(/ADCDA/g, USERNAME);
        return client.submitJCL(jcl)
            .then((jobId: string) => {
                const deferred = Q.defer();
                setTimeout(() => {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                    pollJCLJobStatus(deferred, client, job.jobName, jobId, MAX_QUERIES);
                }, QUERY_INTERVAL);
                return deferred.promise;
            });
    }

    function pollJCLJobStatus(deferred: Q.Deferred<unknown>, client: ZosAccessor, jobName: string,
                              jobId: string, timeOutCount: number): void {
        if (timeOutCount === 0) {
            deferred.resolve(JobStatusResult.FAIL);
        }

        client.queryJob({ jobId })
            .then((rc) => {
                if (rc === JobStatusResult.SUCCESS || rc === JobStatusResult.FAIL) {
                    deferred.resolve({ jobName, jobId, rc });
                } else {
                    setTimeout(() => {
                        pollJCLJobStatus(deferred, client, jobName, jobId, timeOutCount - 1);
                    }, QUERY_INTERVAL);
                }
            });
    }
});
