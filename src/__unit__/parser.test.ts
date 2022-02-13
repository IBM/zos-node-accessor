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

import { parseDataSets, parseLoadLibPDSMembers, parsePDSMembers, parseUSSDirList } from '../parser';
import { rawDatasetList, rawLoadLibMemberList, rawUSSList, rawUSSList2, rawUSSList3 } from './testInput';

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

    it('can parse LoadLib PDS member list correctly', () => {
        const datasetList = parseLoadLibPDSMembers(rawLoadLibMemberList);
        expect(datasetList.length).toBe(2);
        expect(datasetList[0].name).toBe('DD');
        expect(datasetList[0].size).toBe(252888);
        expect(datasetList[0].ttr).toBe('031506');
        expect(datasetList[0].aliasOf).toBe('IRRENV00');
        expect(datasetList[0].ac).toBe(1);
        expect(datasetList[0].attributes).toBe('FO             RN RU');
        expect(datasetList[0].amode).toBe('31');
        expect(datasetList[0].rmode).toBe('24');
        expect(datasetList[1].name).toBe('DMOCI001');
        expect(datasetList[1].size).toBe(1808);
        expect(datasetList[1].ttr).toBe('03370C');
        expect(datasetList[1].aliasOf).toBe('');
        expect(datasetList[1].ac).toBe(0);
        expect(datasetList[1].attributes).toBe('FO');
        expect(datasetList[1].amode).toBe('31');
        expect(datasetList[1].rmode).toBe('ANY');
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

    it('can list file of USS', () => {
        const fileList = parseUSSDirList(rawUSSList, false);
        expect(fileList.length).toBe(7);
        expect(fileList).toMatchSnapshot();
    });

    it('can list symbolic link file of USS', () => {
        const fileList = parseUSSDirList(rawUSSList2, false);
        expect(fileList.length).toBe(1);
        expect(fileList[0].name).toBe('zzz2');
        expect(fileList[0].linkTo).toBe('/');
        expect(fileList).toMatchSnapshot();
    });

    it('can ignore bad lines when listing USS files', () => {
        const fileList = parseUSSDirList(rawUSSList3, false);
        expect(fileList.length).toBe(0);
    });

});
