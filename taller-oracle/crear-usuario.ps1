param(
  [string]$SqlPlus = 'sqlplus',
  [ValidatePattern('^[A-Za-z][A-Za-z0-9_]*$')][string]$Pdb = 'FREEPDB1',
  [string]$ConnectString = 'localhost:1521/FREEPDB1'
)
$ErrorActionPreference = 'Stop'
$envPath = Join-Path $PSScriptRoot '.env'
if (Test-Path -LiteralPath $envPath) { throw 'Ya existe .env; no se modificó el usuario ni la configuración.' }
$claveTaller = 'Tr_' + [Guid]::NewGuid().ToString('N') + '9a'
$sqlTaller = @"
WHENEVER SQLERROR EXIT SQL.SQLCODE
ALTER SESSION SET CONTAINER = $Pdb;
CREATE USER TALLER_REDIS IDENTIFIED BY "$claveTaller" DEFAULT TABLESPACE USERS QUOTA 100M ON USERS;
GRANT CREATE SESSION, CREATE TABLE TO TALLER_REDIS;
EXIT
"@
$salidaTaller = $sqlTaller | & $SqlPlus -S '/ as sysdba' 2>&1
if ($LASTEXITCODE -ne 0) { throw ($salidaTaller -join "`n") }
@"
ORACLE_USER=TALLER_REDIS
ORACLE_PASSWORD=$claveTaller
ORACLE_CONNECT_STRING=$ConnectString
REDIS_URL=redis://127.0.0.1:6385
TTL_SECONDS=20
PORT=3005
"@ | Set-Content -LiteralPath $envPath -Encoding utf8
Write-Output "Usuario TALLER_REDIS creado en $Pdb. Conexión guardada en .env; contraseña omitida de la salida."
