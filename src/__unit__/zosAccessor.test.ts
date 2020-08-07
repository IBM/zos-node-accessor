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

import ftp4 from 'ftp4';

jest.mock('ftp4');

const mockFtp4 = {
    ascii: jest.fn().mockImplementation((callback) => {
        callback(null);
    }),
    delete: jest.fn(),
    end: jest.fn(),
    get: jest.fn(),
    list: jest.fn(),
    logout: jest.fn(),
    put: jest.fn().mockImplementation((arg1, arg2, callback) => {
        callback(null);
    }),
    rename: jest.fn(),
    site: jest.fn().mockImplementation((arg, callback) => {
        callback(null);
    }),
};

ftp4.mockImplementation(() => {
    return mockFtp4;
});

import Q from 'q';
import * as stream from 'stream';

import { SpoolFile } from '../interfaces/SpoolFile';
import { JobStatusResult, TransferMode, ZosAccessor } from '../zosAccessor';
import { rawDatasetList } from './testInput';
import { Stats } from 'fs';

const USERNAME = 'ADCDA';

let rawJobList: string[];

describe('z/OS node accessor', () => {
    let client: ZosAccessor;
    const uploadDSN = 'DELETE.ME';

    beforeEach(() => {
        client = new ZosAccessor();
        mockFtp4.ascii.mockClear();
        mockFtp4.site.mockClear();
        mockFtp4.put.mockClear();
        mockFtp4.get.mockClear();
        mockFtp4.list.mockClear();
        mockFtp4.rename.mockClear();
        mockFtp4.delete.mockClear();
        mockFtp4.end.mockClear();
    });

    beforeEach(() => {

        rawJobList = [
            'JOBNAME  JOBID    OWNER    STATUS CLASS',
            'HISCONVT JOB17459 MIAOCX   OUTPUT A        RC=0000 6 spool files',
            'HISCONVT JOB17462 MIAOCX   ACTIVE A',
            'EZA2284I JOB00083 USER1    OUTPUT A ABEND=806 3 spool files',
            'EZA2284I JOB00082 USER1    OUTPUT A (JCL error) 3 spool files',
            'EZA2284I JOB00093 USER1    INPUT  A -HELD-',
            'HISCONVT JOB17463 MIAOCX   held',
        ];
    });

    it('can upload to remote dataset', async () => {
        await client.uploadDataset('just delete me', uploadDSN, TransferMode.ASCII);
        expect(mockFtp4.ascii).toBeCalled();
        expect(mockFtp4.put).toBeCalledWith('just delete me', '\'' + uploadDSN + '\'', expect.any(Function));
    });

    it('can list root folder of USS', async () => {
        const rawUSSList = [
            'total 554',
            'lrwxrwxrwx     1 CLASGEN  GRP2611        9 Jul 13 19:13 $SYSNAME -> $SYSNAME/',
            'lrwxrwxrwx     1 CLASGEN  GRP2611        9 Jul 13 19:13 $VERSION -> $VERSION/',
            'drwxr-xr-x    10 CLASGEN  DEFLT1      8192 Jul 13 18:52 CEC3',
            '-rwx------     1 CLASGEN  GRP2611     1749 Aug 25  2004 DetailMerge',
        ];
        mockFtp4.list = jest.fn().mockImplementation((arg1, callback) => {
                callback(null, rawUSSList);
        });
        const list = await client.listDatasets('/');
        expect(list.length).toBeGreaterThan(1);
        expect(mockFtp4.list).toBeCalled();
    });

    it('can list root folder of data set', async () => {
        mockFtp4.list = jest.fn().mockImplementation((arg1, callback) => {
            callback(null, rawDatasetList);
        });
        const list = await  client.listDatasets(USERNAME + '.*');
        expect(list.length).toBeGreaterThan(1);
        let foundUploaded = false;
        for (const entry of list) {
            const dsname = entry.name;
            if (dsname && dsname.endsWith(uploadDSN)) {
                foundUploaded = true;
            }
        }
        expect(foundUploaded).toBeTruthy();
        expect(mockFtp4.list).toBeCalled();
    });

    it('can rename dataset', async () => {
        mockFtp4.rename = jest.fn().mockImplementation((oldName, newName, callback) => {
            callback(null);
        });
        await client.renameDataset(uploadDSN, uploadDSN + 'rename');
        await client.renameDataset(uploadDSN + 'rename', uploadDSN);
        expect(mockFtp4.rename).toBeCalled();
    });

    it('can delete dataset', async () => {
        mockFtp4.delete = jest.fn().mockImplementation((oldName, callback) => {
            callback(null);
        });
        await client.deleteDataset(uploadDSN);
        expect(mockFtp4.delete).toBeCalled();
    });

    let submittedJobId: string;

    let jobStatusResp = '' +
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

    const jobStatusOfAbend = '' +
        'JOBNAME  JOBID    OWNER    STATUS CLASS\n' +
        'HELLO    TSU18242 USER     OUTPUT TSU      ABEND=622 \n' +
        '--------\n' +
        '         ID  STEPNAME PROCSTEP C DDNAME   BYTE-COUNT  \n' +
        '         001 PROC01   PROC01   B SYS00010       192 \n' +
        '1 spool files ';

    const jobStatusOfJCLError = '' +
        'JOBNAME  JOBID    OWNER    STATUS CLASS\n' +
        'HELLO    JOB00256 USER     OUTPUT A        (JCL error) \n' +
        '--------\n' +
        '         ID  STEPNAME PROCSTEP C DDNAME   BYTE-COUNT  \n' +
        '         001 JES2        N/A   A JESMSGLG      1590 \n' +
        '         002 JES2        N/A   A JESJCL         627 \n' +
        '         003 JES2        N/A   A JESYSMSG      1188 \n' +
        '3 spool files ';

    it('can submit JCL', async () => {
        mockFtp4.put = jest.fn().mockImplementation((arg1, arg2, callback) => {
            callback(null, 'It is known to JES as JOB12345\n', 520);
        });
        const helloJCL = '//UTHELLO JOB (999,POK),\'METAL\',CLASS=A,MSGCLASS=H,NOTIFY=&SYSUID\r\n' +
            '//STEP0001 EXEC PGM=IEBGENER\r\n' +
            '//SYSIN    DD DUMMY\r\n' +
            '//SYSPRINT DD SYSOUT=*\r\n' +
            '//SYSUT1   DD *\r\n' +
            'HELLO, WORLD\r\n' +
            '/*\r\n' +
            '//SYSUT2   DD SYSOUT=*\r\n//';
        const jobId = await client.submitJCL(helloJCL);
        submittedJobId = jobId;
        jobStatusResp = jobStatusResp.replace('JOB12345', submittedJobId);
        expect(jobId).toMatch(/^\w+\d+$/);
        expect(mockFtp4.put).toBeCalled();
    });

    it('can get job status of RC=0', async () => {
        mockFtp4.list = jest.fn().mockImplementation((arg1, callback) => {
            callback(null, jobStatusResp.split('\n'));
        });

        const status = await client.getJobStatus({ jobId: submittedJobId });
        const spoolFiles = status.spoolFiles as SpoolFile[];
        expect(spoolFiles.length).toBeGreaterThan(0);
        expect(status.rc).toBe(0);
        expect(status.retcode).toBe('RC 0000');
        expect(status.jobId).toEqual(submittedJobId);
        expect(mockFtp4.list).toBeCalled();
    });

    it('can get job status of RC=ABEND', async () => {
        mockFtp4.list = jest.fn().mockImplementation((arg1, callback) => {
            callback(null, jobStatusOfAbend.split('\n'));
        });

        const status = await client.getJobStatus({ jobId: 'TSU18242' });
        const spoolFiles = status.spoolFiles as SpoolFile[];
        expect(spoolFiles.length).toBeGreaterThan(0);
        expect(status.rc).toBe('ABEND=622');
        expect(status.retcode).toBe('ABEND 622');
        expect(status.jobId).toEqual('TSU18242');
        expect(mockFtp4.list).toBeCalled();
    });

    it('can get job status of RC=JCL Error', async () => {
        mockFtp4.list = jest.fn().mockImplementation((arg1, callback) => {
            callback(null, jobStatusOfJCLError.split('\n'));
        });

        const status = await client.getJobStatus({ jobId: 'JOB00256' });
        const spoolFiles = status.spoolFiles as SpoolFile[];
        expect(spoolFiles.length).toBeGreaterThan(0);
        expect(status.rc).toBe('(JCL error)');
        expect(status.retcode).toBe('JCL ERROR');
        expect(status.jobId).toEqual('JOB00256');
        expect(mockFtp4.list).toBeCalled();
    });

    it('can get job log', async () => {
        const bufferStream = new stream.PassThrough();
        const s = 'MINUTES EXECUTION TIME\n!! END OF JES SPOOL FILE !!AAA\n!! END OF JES SPOOL FILE !!';
        bufferStream.end(new Buffer(s));
        mockFtp4.list = jest.fn().mockImplementation((arg1, callback) => {
            callback(null, jobStatusResp.split('\n'));
        });
        mockFtp4.get = jest.fn().mockImplementation((arg1, callback) => {
            callback(null, bufferStream);
        });

        const log = await client.getJobLog({ jobId: submittedJobId });
        expect(mockFtp4.get).toBeCalledWith(submittedJobId + '.x', expect.any(Function));
        expect(log.length).toBeGreaterThan(0);
        // const spoolFile = log[0] as SpoolFile;
        // expect(spoolFile.content).toEqual('MINUTES EXECUTION TIME');
        // expect(spoolFile.ddname).toEqual('JESMSGLG');
        // expect(spoolFile.stepname).toEqual('JES2');
        // expect(spoolFile.byteCount).toEqual(1206);
        // expect(mockFtp4.list).toBeCalled();
        expect(mockFtp4.get).toBeCalled();
    });

    it('can parse job list', async () => {
        mockFtp4.list = jest.fn().mockImplementation((path, callback) => {
            callback(null, rawJobList);
        });

        await Q.all([
            client.queryJob({ jobId: 'JOB17459'}).then((status) => {
                expect(status).toBe(JobStatusResult.SUCCESS);
            }),
            client.queryJob({ jobId: 'JOB17462'}).then((status) => {
                expect(status).toBe(JobStatusResult.ACTIVE);
            }),
            client.queryJob({ jobId: 'JOB00083'}).then((status) => {
                expect(status).toBe(JobStatusResult.FAIL);
            }),
            client.queryJob({ jobId: 'JOB00082'}).then((status) => {
                expect(status).toBe(JobStatusResult.FAIL);
            }),
            client.queryJob({ jobId: 'JOB00093'}).then((status) => {
                expect(status).toBe(JobStatusResult.WAITING);
            }),
            client.queryJob({ jobId: 'JOB17463'}).then((status) => {
                expect(status).toBe(JobStatusResult.FAIL);
            }),
            client.queryJob({ jobId: 'JOB_NON_EXIST'}).then((status) => {
                expect(status).toBe(JobStatusResult.NOT_FOUND);
            }),
        ]);
        expect(mockFtp4.list).toBeCalled();
    });

    it('can list job on condition', async () => {
        mockFtp4.list = jest.fn().mockImplementation((path, callback) => {
            callback(null, rawJobList);
        });
        const jobList = await client.listJobs({jobName: '*'});
        expect(jobList.length).toBeGreaterThan(1);
        expect(mockFtp4.list).toBeCalled();
    });

    it('can read correct RC code from JESMSGLG', async () => {
        const rawJCLMSGLG = [
            '1                     J E S 2  J O B  L O G  --  S Y S T E M  C E C 3  --  N O D E  X R F M C L          ',
            '0 ',
             '02.07.44 JOB07186 ---- FRIDAY,    12 JUL 2019 ----',
             '02.07.44 JOB07186  IRR010I  USERID USER001  IS ASSIGNED TO THIS JOB.',
             '02.07.44 JOB07186  ICH70001I USER001  LAST ACCESS AT 02:06:03 ON FRIDAY, JULY 12, 2019',
             '02.07.44 JOB07186  $HASP373 TESTJOB1 STARTED - INIT 10   - CLASS A        - SYS CEC3',
             '02.07.44 JOB07186  IEF403I TESTJOB1 - STARTED - TIME=02.07.44',
             // tslint:disable-next-line: max-line-length
             '02.07.45 JOB07186  - ==============================================================================================================',
             // tslint:disable-next-line: max-line-length
             '02.07.45 JOB07186  -                                    REGION        --- STEP TIMINGS ---                   ----PAGING COUNTS----',
             // tslint:disable-next-line: max-line-length
             '02.07.45 JOB07186  - STEPNAME PROCSTEP PGMNAME     CC     USED      CPU TIME  ELAPSED TIME    EXCP     SERV  PAGE  SWAP   VIO SWAPS',
             // tslint:disable-next-line: max-line-length
             '02.07.45 JOB07186  - STARNOTE          BPXBATCH    00     168K    0:00:00.04    0:00:00.89     185      554     0     0     0     0',
             // tslint:disable-next-line: max-line-length
             '02.07.54 JOB07186  - TESTJOB1 JAVAJVM  JVMLDM76    00      56K    0:01:14.88    0:00:09.10   1149K    1494K     0     0     0     0',
             // tslint:disable-next-line: max-line-length
             '02.07.54 JOB07186  - DELONERR          IDCAMS   FLUSH       0K    0:00:00.00    0:00:00.00       0        0     0     0     0     0',
             // tslint:disable-next-line: max-line-length
             '02.07.54 JOB07186  - FAILNOTE          BPXBATCH FLUSH       0K    0:00:00.00    0:00:00.00       0        0     0     0     0     0',
             // tslint:disable-next-line: max-line-length
             '02.07.55 JOB07186  - SUCCNOTE          BPXBATCH    00     168K    0:00:00.03    0:00:00.74     185      507     0     0     0     0',
             '02.07.55 JOB07186  IEF404I TESTJOB1 - ENDED - TIME=02.07.55',
             // tslint:disable-next-line: max-line-length
             '02.07.55 JOB07186  - ==============================================================================================================',
             // tslint:disable-next-line: max-line-length
             '02.07.55 JOB07186  - NAME-                     TOTALS: CPU TIME=   0:01:14.95  ELAPSED TIME=   0:00:10.73 SERVICE UNITS=  1495K',
             // tslint:disable-next-line: max-line-length
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
        const bufferStream = new stream.PassThrough();
        bufferStream.end(new Buffer(rawJCLMSGLG.join('\n')));
        mockFtp4.get = jest.fn().mockImplementation((arg1, callback) => {
            callback(null, bufferStream);
        });
        const rc = await client.getRCFromJESMSGLG({jobId: 'jobId'});
        expect(rc).toBe(8);
        expect(mockFtp4.get).toBeCalled();
    });

    it('can read correct RC code from JESMSGLG when job canceled', async () => {
        const rawJCLMSGLG = [
            '1                    J E S 2  J O B  L O G  --  S Y S T E M  P 2 1    --  N O D E  P K P A T 2 1',
            '0',
             '21.55.49 JOB18527 ---- THURSDAY,  06 AUG 2020 ----',
             '21.55.49 JOB18527  IRR010I  USERID TNZSYS   IS ASSIGNED TO THIS JOB.',
             '21.55.49 JOB18527  ICH70001I TNZSYS   LAST ACCESS AT 21:52:18 ON THURSDAY, AUGUST 6, 2020',
             '21.55.49 JOB18527  $HASP373 SLEEP    STARTED - INIT 1    - CLASS A        - SYS P21',
             '21.55.57 JOB18527  BPXP018I THREAD 14C5880000000000, IN PROCESS 83951641, ENDED  161',
             '   161             WITHOUT BEING UNDUBBED WITH COMPLETION CODE 40222000',
             '   161             , AND REASON CODE 00000000.',
             '21.55.57 JOB18527  IEF450I SLEEP SLEEP - ABEND=S222 U0000 REASON=00000000  162',
             '   162                     TIME=21.55.57',
             '21.55.57 JOB18527  -                                         --TIMINGS (MINS.)--            ----PAGING COUNTS---',
             '21.55.57 JOB18527  -JOBNAME  STEPNAME PROCSTEP    RC   EXCP    CPU    SRB  CLOCK   SERV  PG   PAGE   SWAP    VIO SWAPS',
             '21.55.57 JOB18527  -SLEEP             SLEEP    *S222    204 ******    .00     .1    807   0      0      0      0     0',
             '21.55.57 JOB18527  -SLEEP    ENDED.  NAME-                     TOTAL CPU TIME=   .00  TOTAL ELAPSED TIME=    .1',
             '21.55.57 JOB18527  $HASP395 SLEEP    ENDED - ABEND=S222',
            '0------ JES2 JOB STATISTICS ------',
            '-  06 AUG 2020 JOB EXECUTION DATE',
            '-            5 CARDS READ',
            '-           55 SYSOUT PRINT RECORDS',
            '-            0 SYSOUT PUNCH RECORDS',
            '-            7 SYSOUT SPOOL KBYTES',
            '-         0.13 MINUTES EXECUTION TIME',
        ];
        const bufferStream = new stream.PassThrough();
        bufferStream.end(new Buffer(rawJCLMSGLG.join('\n')));
        mockFtp4.get = jest.fn().mockImplementation((arg1, callback) => {
            callback(null, bufferStream);
        });
        const rc = await client.getRCFromJESMSGLG({jobId: 'jobId'});
        expect(rc).toBe('ABEND S222');
        expect(mockFtp4.get).toBeCalled();
    });

    it('can read correct RC code from JESMSGLG when job has security error', async () => {
        const rawJCLMSGLG = [
            '1                    J E S 2  J O B  L O G  --  S Y S T E M  P 2 1    --  N O D E  P K P A T 2 1',
            '0',
             '01.31.28 JOB18539 ---- FRIDAY,    07 AUG 2020 ----',
             '01.31.28 JOB18539  ICH408I USER(XIXUE   ) GROUP(TESTER  ) NAME(XI XUE BJ JIA       )',
             '                     SUBMITTER(TNZSYS  )',
             '                   LOGON/JOB INITIATION - SUBMITTER IS NOT AUTHORIZED BY USER',
            '-$HASP106 JOB DELETED BY JES2 OR CANCELLED BY OPERATOR BEFORE EXECUTION',
            '0------ JES2 JOB STATISTICS ------',
            '0           11 CARDS READ',
            '0           13 SYSOUT PRINT RECORDS',
            '0            0 SYSOUT PUNCH RECORDS',
            '0            0 SYSOUT SPOOL KBYTES',
            '0         0.00 MINUTES EXECUTION TIME',
        ];
        const bufferStream = new stream.PassThrough();
        bufferStream.end(new Buffer(rawJCLMSGLG.join('\n')));
        mockFtp4.get = jest.fn().mockImplementation((arg1, callback) => {
            callback(null, bufferStream);
        });
        const rc = await client.getRCFromJESMSGLG({jobId: 'jobId'});
        expect(rc).toBe('SEC ERROR');
        expect(mockFtp4.get).toBeCalled();
    });

    it('can change max buffer size for downloading', async () => {
        let bufferStream = new stream.PassThrough();
        bufferStream.end(new Buffer('1234567890'));
        mockFtp4.get = jest.fn().mockImplementation((arg1, callback) => {
            callback(null, bufferStream);
        });

        // The error is expected with the small buffer size.
        const message = 'Reach the maximum buffer size, 4 bytes. Change to use stream mode for big file.';
        client.setMaxBufferSize(4);
        try {
            await client.downloadDataset('dsn');
            fail();
        } catch (err) {
            expect(err.message).toBe(message);
        }

        // Come back to large buffer size
        bufferStream = new stream.PassThrough();
        bufferStream.end(new Buffer('1234567890'));
        mockFtp4.get = jest.fn().mockImplementation((arg1, callback) => {
            callback(null, bufferStream);
        });
        client.setMaxBufferSize(400);
        const s = await client.downloadDataset('dsn');
        expect(s.toString()).toBe('1234567890');
    });

    it('can convert allocation parameter object to string', async () => {
        await client.uploadDataset('hello', uploadDSN, TransferMode.ASCII, { LRECL: 80, RECFM: 'FB'});
        expect(mockFtp4.site).toBeCalledWith('FILETYPE=SEQ LRECL=80 RECFM=FB', expect.any(Function));
    });
});
