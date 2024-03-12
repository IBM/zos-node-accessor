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

import { ZosAccessor, JobListOption } from '../zosAccessor';
import { connectFTPServer, submitHelloJob } from './testUtils';

describe('The method of listJobs()', () => {

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

    it('can list all jobs', async () => {
        const list = await accessor.listJobs();
        expect(list.length).toBeGreaterThan(0);
    });

    it('can list jobs by job ID', async () => {
        const { status: status1, jobName, jobId } = await submitHelloJob(accessor);
        expect(status1.rc).toBe(0);
        const { status: status2 } = await submitHelloJob(accessor);
        expect(status2.rc).toBe(0);

        const queryOption: JobListOption = {
            jobId,
        };
        const list = await accessor.listJobs(queryOption);
        expect(list.length).toBeGreaterThan(0);
        list.forEach((job) => {
            expect(job.jobName).toBe(jobName);
            expect(job.jobId).toBe(jobId);
            expect(job.owner).toBeDefined();
            expect(job.status).toBeDefined();
            expect(job.class).toBeDefined();
        });
    });


    it('can list jobs by job name', async () => {
        const { status: status1, jobName } = await submitHelloJob(accessor);
        expect(status1.rc).toBe(0);
        const { status: status2 } = await submitHelloJob(accessor);
        expect(status2.rc).toBe(0);

        const queryOption: JobListOption = {
            jobName,
        };
        const list = await accessor.listJobs(queryOption);
        expect(list.length).toBeGreaterThan(0);
        list.forEach((job) => {
            expect(job.jobName).toBe(jobName);
            expect(job.jobId).toBeDefined();
            expect(job.owner).toBeDefined();
            expect(job.status).toBeDefined();
            expect(job.class).toBeDefined();
        });
    });

    it('can list jobs by status', async () => {
        const { status: status1, jobName } = await submitHelloJob(accessor);
        expect(status1.rc).toBe(0);

        const queryOption: JobListOption = {
            jobName,
            status: 'OUTPUT',
        };
        const list = await accessor.listJobs(queryOption);
        expect(list.length).toBeGreaterThan(0);
        list.forEach((job) => {
            expect(job.jobName).toBe(jobName);
            expect(job.jobId).toBeDefined();
            expect(job.owner).toBeDefined();
            expect(job.status).toBe('OUTPUT');
            expect(job.class).toBeDefined();
        });
    });

    it('can list no jobs by wrong job name', async () => {
        const queryOption: JobListOption = {
            jobName: 'WRONG',
        };
        const list = await accessor.listJobs(queryOption);
        expect(list.length).toBe(0);
    });

    it('can list no jobs by wrong owner', async () => {
        const queryOption: JobListOption = {
            owner: 'WRONG',
        };
        const list = await accessor.listJobs(queryOption);
        expect(list.length).toBe(0);
    });

    it('list job with invalid job name', async () => {
        const queryOption: JobListOption = {
            jobName: 'WRONG1234',
        };
        try{
        const list = await accessor.listJobs(queryOption);
        } catch (err) {
            expect(err.message).toBe("Value of prefix or owner is not valid. It is longer than 8 characters.");
        }
    });

    it('list job with invalid owner', async () => {
        const queryOption: JobListOption = {
            owner: 'WRONG1234',
        };
        try{
        const list = await accessor.listJobs(queryOption);
    } catch (err) {
        expect(err.message).toBe("Value of prefix or owner is not valid. It is longer than 8 characters.");
    }
    });
});
