param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [Parameter(Mandatory = $true)]
    [string]$Token,

    [string]$AccountsDir = "$PSScriptRoot\server-data\accounts",

    [switch]$Overwrite
)

$ErrorActionPreference = 'Stop'

$base = $BaseUrl.TrimEnd('/')

if (-not (Test-Path -LiteralPath $AccountsDir)) {
    throw "Không tìm thấy thư mục account: $AccountsDir"
}

$files = Get-ChildItem -LiteralPath $AccountsDir -File -Filter '*.properties' | Sort-Object Name
if (-not $files) {
    throw "Không có file account nào trong: $AccountsDir"
}

$overwriteValue = if ($Overwrite.IsPresent) { 'true' } else { 'false' }
$results = New-Object System.Collections.Generic.List[object]

foreach ($file in $files) {
    $username = $file.BaseName
    $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8

    try {
        $response = Invoke-RestMethod `
            -Method Post `
            -Uri "$base/api/admin/import-account" `
            -Body @{
                token = $Token
                username = $username
                content = $content
                overwrite = $overwriteValue
            } `
            -ContentType 'application/x-www-form-urlencoded'

        $results.Add([pscustomobject]@{
            Username = $username
            Status = $response.status
            Message = ''
        })
    } catch {
        $results.Add([pscustomobject]@{
            Username = $username
            Status = 'error'
            Message = $_.Exception.Message
        })
    }
}

$results | Format-Table -AutoSize
