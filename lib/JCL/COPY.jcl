//*******************************************************************
//*                                                                    
//* Copyright (c) 2017 IBM Corp.                                     
//* All rights reserved. This program and the accompanying materials 
//* are made available under the terms of the Eclipse Public License 
//* v1.0 which accompanies this distribution, and is available at   
//* http://www.eclipse.org/legal/epl-v10.html                       
//*                                                                 
//* Contributors:                                                   
//*  IBM Corp. - initial API and implementation                     
//*                                                                 
//*******************************************************************
//COPY     JOB ,NOTIFY=&SYSUID,CLASS=A,MSGLEVEL=(1,1),MSGCLASS=__MSGCLASS__
//IEBCOPY  EXEC PGM=IEBCOPY 
//SYSPRINT DD SYSOUT=*
//FROMDD   DD DSN=__FROM__,DISP=SHR
//TODD     DD DSN=__TO__,DISP=SHR
//SYSIN    DD *
    COPY INDD=FROMDD,OUTDD=TODD                    
       SELECT MEMBER=(__MEMBER__)
