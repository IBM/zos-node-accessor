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

class Utils {

    public static isFullQualifiedDSN(dsn: string): boolean {
        return dsn[0] === '\'' && dsn[dsn.length - 1] === '\'';
    }

    public static stripQuotes(dsn: string): string {
        if (Utils.isFullQualifiedDSN(dsn)) {
            return dsn.substring(1, dsn.length - 1);
        }
        return dsn;
    }

    public static ensureFullQualifiedDSN(dsn: string): string {
        if (dsn.indexOf('/') !== 0 && !Utils.isFullQualifiedDSN(dsn)) {
            dsn = '\'' + dsn + '\'';
        }
        return dsn;
    }

    public static removeQuote(dsn: string): string {
        let removed = dsn;
        if (removed.charAt(0) === '\'') {
            removed = removed.substring(1);
        }
        if (removed.charAt(removed.length - 1) === '\'') {
            removed = removed.substring(0, removed.length - 1);
        }
        return removed;
    }
}

export { Utils };
