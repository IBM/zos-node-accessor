/****************************************************************************/
/*                                                                          */
/* Copyright (c) 2017, 2021 IBM Corp.                                       */
/* All rights reserved. This program and the accompanying materials         */
/* are made available under the terms of the Eclipse Public License v1.0    */
/* which accompanies this distribution, and is available at                 */
/* http://www.eclipse.org/legal/epl-v10.html                                */
/*                                                                          */
/* Contributors:                                                            */
/*  IBM Corp. - initial API and implementation                              */
/*                                                                          */
/****************************************************************************/

export const rawDatasetList = [
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
    'F1SYS1 3390   2017/02/27  1    1  VB     256  6233  PS  DELETE.ME',
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
    '250 List completed successfully.',
];

export const rawLoadLibMemberList = [ 
    ' Name      Size     TTR   Alias-of AC --------- Attributes --------- Amode Rmode ',
    'DD        03DBD8   031506 IRRENV00 01 FO             RN RU            31    24   ',
    'DMOCI001  000710   03370C          00 FO                              31    ANY  ',
];
