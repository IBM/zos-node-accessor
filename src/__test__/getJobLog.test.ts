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

import { ZosAccessor, JobLogOption } from '../zosAccessor';
import { connectFTPServer, submitHelloJob } from './testUtils';

describe('The method of getJobLog()', () => {

    jest.setTimeout(60000);
    let accessor: ZosAccessor;

    beforeEach(async () => {
        accessor = await connectFTPServer();
    });

    afterEach(async () => {
        if (accessor) {
            await accessor.close();
        }
    });

    it('can get job log file', async () => {
        const { status, jobId } = await submitHelloJob(accessor);
        expect(status.rc).toBe(0);

        const logQuery: JobLogOption = { jobId, fileId: 1 };
        const log = await accessor.getJobLog(logQuery);
        expect(log).toContain('HELLO    ENDED - RC=0000');
    });

    it('can get all job log files', async () => {
        const { status, jobId } = await submitHelloJob(accessor);
        expect(status.rc).toBe(0);

        const logQuery: JobLogOption = { jobId, fileId: -1 };
        const log = await accessor.getJobLog(logQuery);
        const spoolFiles = log.split('\n').filter((line) => {
            return line.indexOf('END OF JES SPOOL FILE') !== -1;
        }).length;
        expect(spoolFiles).toBe(5);
    });

    it('can get the error of "No jobs found", if job ID is wrong', async () => {
        const { status } = await submitHelloJob(accessor);
        expect(status.rc).toBe(0);

        try {
            expect.assertions(2);
            const logQuery: JobLogOption = { jobId: 'JOB12345' };
            await accessor.getJobLog(logQuery);
        } catch (err) {
            expect(err.message).toContain('not found');
        }
    });

    it('can get the error of "No jobs found", if owner is wrong', async () => {
        const { status, jobId } = await submitHelloJob(accessor);
        expect(status.rc).toBe(0);

        try {
            expect.assertions(2);
            const logQuery: JobLogOption = { jobId, owner: 'Wrong' };
            await accessor.getJobLog(logQuery);
        } catch (err) {
            expect(err.message).toContain('not found');
        }
    });

    it('can get the error of "Index 99 is greater than number of spool files", if fileId is wrong', async () => {
        const { status, jobId } = await submitHelloJob(accessor);
        expect(status.rc).toBe(0);

        try {
            expect.assertions(2);
            const logQuery: JobLogOption = { jobId, fileId: 99 };
            await accessor.getJobLog(logQuery);
        } catch (err) {
            expect(err.message).toContain('Index 99 is greater than number of spool files');
        }
    });
});
