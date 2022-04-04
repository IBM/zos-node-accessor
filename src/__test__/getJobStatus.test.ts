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

import { JobIdOption } from '../interfaces/JobIdOption';
import { SpoolFile } from '../interfaces/SpoolFile';
import { ZosAccessor } from '../zosAccessor';
import { connectFTPServer, submitHelloJob, USERNAME } from './testUtils';

describe('The method of getJobStatus()', () => {

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

    it('can get job status', async () => {
        const { status } = await submitHelloJob(accessor);

        expect(status.rc).toBe(0);
        expect(status.jobName).toBe('HELLO');
        expect(status.owner).toBe(USERNAME);
        expect(status.status).toBe('OUTPUT');
        expect(status.class).toBe('A');
        expect(status.extra).toBe('RC=0000');

        const queryStatus: JobIdOption = { jobId: status.jobId };
        const jobStatus = await accessor.getJobStatus(queryStatus);
        expect(jobStatus.spoolFiles?.length).toBe(5);
        const spoolFiles = jobStatus.spoolFiles as SpoolFile[];
        expect(spoolFiles[0].id).toBe(1);
        expect(spoolFiles[0].stepName).toBe('JES2');
        expect(spoolFiles[0].class).toBe('H');
        expect(spoolFiles[0].ddName).toBe('JESMSGLG');
    });

    it('can get the error of "No jobs found", if job ID is wrong', async () => {
        const { status } = await submitHelloJob(accessor);
        expect(status.rc).toBe(0);

        try {
            expect.assertions(2);
            const queryStatus: JobIdOption = { jobId: 'JOB12345' };
            await accessor.getJobStatus(queryStatus);
        } catch (err) {
            expect(err.message).toContain('No jobs found');
        }
    });

    it('can get the error of "No jobs found", if owner is wrong', async () => {
        const { status, jobId } = await submitHelloJob(accessor);
        expect(status.rc).toBe(0);

        try {
            expect.assertions(2);
            const queryStatus: JobIdOption = { jobId, owner: 'WRONG' };
            await accessor.getJobStatus(queryStatus);
        } catch (err) {
            expect(err.message).toContain('No jobs found');
        }
    });
});
