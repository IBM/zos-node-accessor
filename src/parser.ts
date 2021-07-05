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

import { DatasetEntry } from './interfaces/DatasetEntry';
import { DatasetMemberEntry } from './interfaces/DatasetMemberEntry';
import { Job } from './interfaces/Job';
import { LoadLibMemberEntry } from './interfaces/LoadLibMemberEntry';
import { SpoolFile } from './interfaces/SpoolFile';
import { FileType, USSEntry } from './interfaces/USSEntry';
import { Utils } from './utils';


interface Position {
    header: string;
    start: number;
    end: number;
}

/**
 * Parse the header line for the individual headers and their position. For example:
 * 
 * <pre>
 * ' Name      Size     TTR   Alias-of AC'
 * </pre>
 * 
 * It splits headerLine by spaces, and outputs positions as follows;
 * 
 * <pre>
 *   [{
 *     header: 'Name';
 *     start: 1;
 *     end: 5;
 *   }, ...]
 * </pre>
 *
 * @param headerLine input header line
 * @param base adjust the base position for start/end
 * @returns position array
 */
function parseHeader(headerLine: string, base = 0): Position[] {
    const headers = headerLine.split(/\s+/);
    const positions: Position[] = [];
    let lastPosition = 0;
    headers.forEach((header) => {
        // No header is substring of another header.
        const position = { 
            header: header,
            start: base + headerLine.indexOf(header),
            end: base + headerLine.indexOf(header) + header.length
        };
        positions.push(position);
        lastPosition = position.end;
    });
    return positions;
}

/**
 * Parses the field line based the information from position. For example:
 * 
 * <pre>
 * ' Name      Size     TTR   Alias-of AC ',
 * 'DD        03DBD8   031506 IRRENV00 01 '
 * </pre>
 * 
 * To parse the first field of 'Name'. It locates the field with header position, which is 'D    '.
 * Then it searches for ' ' backwards and forwards to determine the actual field string, which is 'DD    '.
 * Finally returns the trimmed string of 'DD'.
 * 
 * Take 'Size' as another example, The field located with header position is '3DBD', which is directly
 * under 'Size'. Then it searches for ' ' backwards/forwards and gets '03DBD8'.
 * 
 * Note: It would not work if no ' ' between two fields, which is handled in `parseDataSets()`
 * 
 * @param line field line to parse
 * @param position position of header
 * @returns the trimmed field string
 */
function parseField(line: string, position: Position): string {
    let start = position.start;
    while (start >= 0) {
        if (line[start] === ' ') {
            break;
        }
        start --;
    }
    let end = position.end;
    while (end < line.length) {
        if (line[end] === ' ') {
            break;
        }
        end ++;
    }
    return line.substring(start, end).trim();
}

/**
 * Parse a list of dataset list strings.
 *
 * @param lines - String list
 * @param migrationMode - True, in the case of migration mode
 * @returns Dateset entries
 */
export function parseDataSets(lines: string[], migrationMode: boolean): DatasetEntry[] {
    if (lines.length === 0) {
        return [];
    }
    const headLine = lines.shift() || '';
    const footLine = lines[lines.length - 1];
    if (footLine.toLowerCase().indexOf('list completed successfully') !== -1) {
        lines.pop();
    }

    //            1         2         3         4         5         6         7         8
    //  012345678901234567890123456789012345678901234567890123456789012345678901234567890
    // 'Volume Unit    Referred Ext Used Recfm Lrecl BlkSz Dsorg Dsname',
    // 'XRFS79 3390   2017/08/04  1 4080  FB    1024 27648  PS  \'USERHLQI.T1.HISPAXZ\'',
    // 'XRFS95 3390   2017/08/04  313875  FB    1024 27648  PS  \'USERHLQI.T2.HISPAXZ\'',
    // 'XRFS61 3390   2017/08/04  1 4500  FB    1024 27648  PS  \'USERHLQI.T3.HISPAXZ\'',
    // 'XRFS67 3390   2017/08/04  314760  FB    1024 27648  PS  \'USERHLQI.T4.HISPAXZ\''

    const headers = headLine.split(/\s+/);
    const positions: Position[] = [];
    let lastPosition = 0;
    headers.forEach((header) => {
        // No header is substring of another header.
        const position = { 
            header: header,
            start: lastPosition, 
            end: headLine.indexOf(header) + header.length
        };
        positions.push(position);
        lastPosition = position.end;
    });

    const entries: DatasetEntry[] = [];
    lines.forEach((line) => {
        let entry: DatasetEntry;
        let fields = line.split(/\s+/);
        entry = {
            fieldNames: [],
            isMigrated: true,
            name: '',
            rawString: line,
        };
        // The Migrated line is special. Process this special case first.
        if (fields[0] === 'Migrated' && fields.length > 1) {
            const dsname = fields[fields.length - 1];
            entry.name = Utils.stripQuotes(dsname);
            entry.isMigrated = true;
            if (migrationMode) {
                entry[headers[0]] = fields[0];          // Migration
                entry.Dsname = entry.name;              // Migration
            }
            entries.push(entry);
            return;
        } else {
            entry.isMigrated = false;
        }
        fields = [];
        positions.forEach((position, index) => {
            let end = position.end;
            if (line.length > end + 1 && line[end] !== ' ' && line[end + 1] === ' ') {
                // Look one more char, in the following case
                //
                // 'Volume Unit    Referred Ext Used Recfm Lrecl BlkSz Dsorg Dsname',
                // 'XRFS95 3390   2017/08/04  313875  FB    1024 27648  PS  \'USERHLQI.T2.HISPAXZ\'',
                //                         ^^
                //                         ||
                //                         |+--- the char after the end position is ' '
                //                         +---- the char at the end position is not ' '
                end ++;

                // Adjust the next start/end pair
                positions[index + 1].start = end;
            }
            if (index === positions.length - 1) {
                end = line.length;
            }
            const field = line.substring(position.start, end);
            fields.push(field.trim());
        });
        if (fields.length === headers.length) {
            for (let i = 0; i < headers.length; ++i) {
                const header = headers[i];
                entry.fieldNames.push(header);
                if (migrationMode) {
                    entry[headers[i]] = fields[i];  // For migration
                }
                switch (header.toUpperCase()) {
                    case 'DSNAME':
                        entry.name = Utils.stripQuotes(fields[i]);
                        if (migrationMode) {
                            entry[headers[i]] = Utils.stripQuotes(fields[i]);  // For migration
                        }
                        break;
                    case 'DSORG':
                        entry.dsOrg = fields[i];
                        break;
                    case 'BLKSZ':
                        entry.blockSize = parseInt(fields[i], 10);
                        break;
                    case 'LRECL':
                        entry.recordLength = parseInt(fields[i], 10);
                        break;
                    case 'RECFM':
                        entry.recordFormat = fields[i];
                        break;
                    case 'USED':
                        entry.usedTracks = parseInt(fields[i], 10);
                        break;
                    case 'EXT':
                        entry.extends = parseInt(fields[i], 10);
                        break;
                    case 'REFERRED':
                        entry.referred = fields[i];
                        break;
                    case 'UNIT':
                        entry.unit = fields[i];
                        break;
                    case 'VOLUME':
                        entry.volume = fields[i];
                        break;
                }
            }
        }
        entries.push(entry);
    });
    return entries;
}

/**
 * Parse a list of PDS members like
 *
 * ```
 * Name     VV.MM   Created       Changed      Size  Init   Mod   Id
 * JVBR30   01.01 2018/09/07 2018/09/07 03:52    13    13     0  AAA
 * ```
 *
 * Meaning of each field:
 * name, version.modification, create date, modification date & time,
 * size in lines, size in lines at creation, lines modified, id of user who modified
 *
 * @param lines - String list
 * @param migrationMode - True, in the case of migration mode
 * @returns Dataset member entries
 */
export function parsePDSMembers(lines: string[], migrationMode: boolean): DatasetMemberEntry[] {
    if (lines.length === 0) {
        return [];
    }
    const headLine = lines.shift() || '';
    const headers = headLine.trim().split(/\s+/);
    const entries: DatasetMemberEntry[] = [];
    lines.forEach((line) => {
        const entry: DatasetMemberEntry = {rawString: line, fieldNames: [], name: ''};
        const fields = line.trim().split(/\s+(?!\d+:)/);
        for (let i = 0; i < headers.length; ++i) {
            entry.fieldNames.push(headers[i]);
            if (migrationMode) {
                entry[headers[i]] = fields[i];  // For migration
            }
            switch (headers[i].toUpperCase()) {
                case 'NAME':
                    entry.name = fields[i];
                    break;
                case 'VV.MM':
                    entry.version = fields[i];
                    break;
                case 'CREATED':
                    entry.created = fields[i];
                    break;
                case 'CHANGED':
                    entry.changed = fields[i];
                    break;
                case 'SIZE':
                    entry.size = parseInt(fields[i], 10);
                    break;
                case 'INIT':
                case 'MOD':
                case 'ID':
                    break;
            }
        }
        entries.push(entry);
    });
    return entries;
}

export function parseLoadLibPDSMembers(lines: string[]): LoadLibMemberEntry[] {
    if (lines.length === 0) {
        return [];
    }

    const headLine = lines.shift() || '';
    const ATTRIBUTES_HEADER = '--------- Attributes ---------';
    const posn1 = headLine.indexOf(ATTRIBUTES_HEADER);
    const posn2 = posn1 + ATTRIBUTES_HEADER.length;
    const header1 = headLine.substring(0, posn1).trim();
    const header3 = headLine.substring(posn2).trim();
    let positions = parseHeader(header1);
    positions.push({
        header: 'ATTRIBUTES',
        start: posn1,
        end: posn2
    });
    positions = positions.concat(parseHeader(header3, posn2));

    const entries: LoadLibMemberEntry[] = [];
    lines.forEach((line) => {
        const entry: LoadLibMemberEntry = {rawString: line, fieldNames: [], name: ''};
        for (let i = 0; i < positions.length; ++i) {
            entry.fieldNames.push(positions[i].header);
            const field = parseField(line, positions[i]);
            
            switch (positions[i].header.toUpperCase()) {
                case 'NAME':
                    entry.name = field;
                    break;
                case 'SIZE':
                    entry.size = parseInt(field, 16);
                    break;
                case 'TTR':
                    entry.ttr = field;
                    break;
                case 'ALIAS-OF':
                    entry.aliasOf = field;
                    break;
                case 'AC':
                    entry.ac = parseInt(field, 10);
                    break;
                case 'ATTRIBUTES':
                    entry.attributes = field;
                    break;
                case 'AMODE':
                    entry.amode = field;
                    break;
                case 'RMODE':
                    entry.rmode = field;
                    break;
            }
        }
        entries.push(entry);
    });
    return entries;
}

/**
 * Parse a list of USS directory list strings.
 *
 * @param lines - Lines
 * @param migrationMode - True, in the case of migration mode
 * @returns USS file entries
 */
export function parseUSSDirList(lines: string[], migrationMode: boolean): USSEntry[] {
    lines.shift();  // Pop header
    const monthText = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const headers = ['permissions', 'links', 'owner', 'group', 'size'];
    const entries: USSEntry[] = [];
    lines.forEach((line) => {
        const entry: USSEntry = {
            fieldNames: [],
            fileType: FileType.FILE,
            group: '',
            lastModified: new Date(),
            name: '',
            owner: '',
            permissions: '',
            rawString: line,
            size: 0,
        };
        const fields = line.split(/\s+/);
        for (let i = 0; i < headers.length; ++i) {
            entry.fieldNames.push(headers[i]);
            if (migrationMode) {
                entry[headers[i]] = fields[i];  // For migration
            }
            switch (headers[i]) {
                case 'permissions':
                    entry.permissions = fields[i];
                    break;
                case 'owner':
                    entry.owner = fields[i];
                    break;
                case 'group':
                    entry.group = fields[i];
                    break;
                case 'size':
                    entry.size = parseInt(fields[i], 10);
                    break;
            }
        }
        if (entry.permissions && typeof entry.permissions === 'string') {
            if (entry.permissions.length > 0 && entry.permissions[0]) {
                switch (entry.permissions[0]) {
                    // drwx------
                    case 'd':
                        entry.fileType = FileType.DIRECTORY;
                        break;
                    // lrwxrwxrwx
                    case 'l':
                        entry.fileType = FileType.LINK;
                        break;
                    // -rwx------
                    case '-':
                        entry.fileType = FileType.FILE;
                        break;
                }
            }
        }
        if (fields[7].indexOf(':') === -1) {
            const year = parseInt(fields[7], 10);
            const month = monthText.indexOf(fields[5]);
            const date = parseInt(fields[6], 10);
            // May  8  2017
            entry.lastModified = new Date(year, month, date);
        } else {
            // Oct  2 09:48
            const now = new Date();
            const month = monthText.indexOf(fields[5]);
            const date = parseInt(fields[6], 10);
            entry.lastModified = new Date(now.getFullYear(), month, date);
        }
        entry.name = fields.slice(8).join(' ');
        const linkPosn = entry.name.indexOf(' -> ');
        if (entry.fileType === FileType.LINK) {
            entry.linkTo = entry.name.substring(linkPosn + ' -> '.length);
            entry.name = entry.name.substring(0, linkPosn);
        }
        entries.push(entry);
    });
    return entries;
}

/**
 * Parses the spool file table.
 *
 * ```
 * ID  STEPNAME PROCSTEP C DDNAME   BYTE-COUNT
 * 001 JES2              H JESMSGLG      1582
 * 002 JES2        N/A   H JESJCL         324
 * 003 JES2        N/A   H JESYSMSG       978
 * ```
 * @param spoolFileTable - Spool file table
 * @param migrationMode - True, in the case of migration mode
 * @returns Spool files
 */
export function parseSpoolTable(spoolFileTable: string[], migrationMode: boolean): SpoolFile[] {
    const headerLine = spoolFileTable[0];
    const headers = [];
    const spoolFiles = [];

    // Columns separated in fixed width, not by space
    const columnRange = [];
    let rangeStart = 0;
    let lastChar = ' ';
    for (let i = 0; i < headerLine.length; ++i) {
        if ((/\s/.test(lastChar) && !/\s/.test(headerLine[i])) || i === headerLine.length - 1) {
            // If last char is a space, current is not, then we are having a new column
            if (headerLine.substring(rangeStart, i).trim().length) {
                // If current column has non-space value, add it
                columnRange.push({start: rangeStart, end: i});
                headers.push(headerLine.substring(rangeStart, i).trim().toUpperCase());
                rangeStart = i;
            }
        }
        lastChar = headerLine[i];
    }
    for (let i = 1; i < spoolFileTable.length; ++i) {
        if (/\d+ spool files/.test(spoolFileTable[i])) {
            break;
        }
        const columns = columnRange.map((range) => {
            return spoolFileTable[i].substring(range.start, range.end).trim();
        });
        const spoolFile: SpoolFile = { id: -1 };  // Spool object to store more info
        headers.forEach((headerName, index) => {
            if (headerName.length) {
                if (migrationMode) {
                    spoolFile[headerName.toLowerCase()] = columns[index];  // For migration
                }
                switch (headerName) {
                    case 'ID':
                        spoolFile.id = parseInt(columns[index], 10);
                        break;
                    case 'STEPNAME':
                        spoolFile.stepName = columns[index];
                        break;
                    case 'PROCSTEP':
                        spoolFile.procStep = columns[index];
                        break;
                    case 'C':
                        spoolFile.class = columns[index];
                        break;
                    case 'DDNAME':
                        spoolFile.ddName = columns[index];
                        break;
                    case 'BYTE-COUNT':
                        spoolFile.byteCount = parseInt(columns[index], 10);
                        break;
                }
           }
        });
        spoolFiles.push(spoolFile);
    }
    return spoolFiles;
}

/**
 * Parses job line.
 *
 * @param line - Job line
 * @returns Job object or undefined
 */
export function parseJobLine(line: string): Job | undefined {
    const fields = line.split(/\s+/);
    // For JESINTERFACELEVEL=2, those fields are JOBNAME, JOBID, OWNER, STATUS, CLASS
    if (fields.length > 3) {
        const job = {
            jobName: fields[0],
            // tslint:disable-next-line: object-literal-sort-keys
            jobId: fields[1],
            owner: fields[2],
            status: fields[3],
            class: fields[4],
            extra: fields.length > 5 ? fields.splice(5).join(' ') : undefined,
        };
        return job;
    }
    return undefined;
}

/**
 * Parses job lines.
 *
 * @param lines - Job lines
 * @returns Job object array
 */
export function parseJobList(lines: string[]): Job[] {
    const jobs: Job[] = [];
    // Skil the first line, which is the header line.
    for (let i = 1; i < lines.length; ++i) {
        /**
         * JOBNAME  JOBID    OWNER    STATUS CLASS
         * HRECALLW JOB31062 LIANGQI  ACTIVE U
         * --------
         *          STEPNAME HRECALL  PROCNAME        N/A
         *          CPUTIME     0.010 ELAPSED TIME     40.934
         */
        // We don't support parsing the CPUTIME and ELASPSED TIME so far.

        /**
         * JOBNAME  JOBID    OWNER    STATUS CLASS
         * HRECALLW JOB31062 LIANGQI  OUTPUT U        RC=0000
         * --------
         *         ID  STEPNAME PROCSTEP C DDNAME   BYTE-COUNT
         *         001 JES2        N/A   H JESMSGLG      1584
         *         002 JES2        N/A   H JESJCL         327
         *         003 JES2        N/A   H JESYSMSG       980
         * 3 spool files
         */
        if (lines[i].startsWith('--------')) {
            // Stop parsing the lines after '--------'.
            break;
        }
        const job = parseJobLine(lines[i]);
        if (job) {
            jobs.push(job);
        }
    }
    return jobs;
}
