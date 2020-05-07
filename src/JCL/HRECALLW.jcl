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
//HRECALLW JOB ,NOTIFY=&SYSUID,CLASS=A,MSGLEVEL=(1,1),MSGCLASS=__MSGCLASS__
//HRECALL EXEC PGM=IEFBR14
//INPUT   DD DSN=__INPUT__,DISP=SHR
