/****************************************************************************/
/*                                                                          */
/* Copyright (c) 2017,2020 IBM Corp.                                        */
/* All rights reserved. This program and the accompanying materials         */
/* are made available under the terms of the Eclipse Public License v1.0    */
/* which accompanies this distribution, and is available at                 */
/* http://www.eclipse.org/legal/epl-v10.html                                */
/*                                                                          */
/* Contributors:                                                            */
/*  IBM Corp. - initial API and implementation                              */
/*                                                                          */
/****************************************************************************/

import { parseDataSets, parsePDSMembers } from '../parser';
import { rawDatasetList } from './testInput';

describe('z/OS node accessor Parser', () => {

    it('can parse MVS data set list correctly', () => {
        const datasetList = parseDataSets(rawDatasetList, false);
        expect(datasetList.length).toBe(45);
        expect(datasetList.filter((e) => e.hasOwnProperty('extends')).length)
            .toBe(44);
    });

    it('can parse PDS member list correctly', () => {
        const rawMemberList = [
            ' Name     VV.MM   Created       Changed      Size  Init   Mod   Id',
            'JVBR30    01.01 2018/09/07 2018/09/07 03:52    13    13     0 USER',
            'JVBR42    01.01 2018/09/07 2018/09/07 07:41    13    13     0 USER',
        ];
        const datasetList = parsePDSMembers(rawMemberList, false);
        expect(datasetList.length).toBe(2);
        expect(datasetList[0].changed).toBe('2018/09/07 03:52');
    });

    it('can parse MVS data set list without space padding correctly', () => {
        const rawList = [
            'Volume Unit    Referred Ext Used Recfm Lrecl BlkSz Dsorg Dsname',
            'XRFS79 3390   2017/08/04  1 4080  FB    1024 27648  PS  \'USERHLQI.T1.HISPAXZ\'',
            'XRFS95 3390   2017/08/04  313875  FB    1024 27648  PS  \'USERHLQI.T2.HISPAXZ\'',
            'XRFS61 3390   2017/08/04  1 4500  FB    1024 27648  PS  \'USERHLQI.T3.HISPAXZ\'',
            'XRFS67 3390   2017/08/04  314760  FB    1024 27648  PS  \'USERHLQI.T4.HISPAXZ\'',
        ];
        const datasetList = parseDataSets(rawList, false);
        expect(typeof datasetList).toBe('object');
        expect(datasetList.length).toBe(4);

        // Verify whether Ext can be separated from Used
        expect(datasetList[1].volume).toBe('XRFS95');
        expect(datasetList[1].unit).toBe('3390');
        expect(datasetList[1].extends).toBe(3);
        expect(datasetList[1].usedTracks).toBe(13875);
        expect(datasetList[1].recordFormat).toBe('FB');
        expect(datasetList[1].recordLength).toBe(1024);
        expect(datasetList[1].blockSize).toBe(27648);
        expect(datasetList[1].dsOrg).toBe('PS');
        expect(datasetList[1].name).toBe('USERHLQI.T2.HISPAXZ');
    });
});
