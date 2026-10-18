# Called as command text with JSON on stdin; no execution-policy or system-setting changes.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType=WindowsRuntime]
$gobblerAsTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Count -eq 1 -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
function Wait-GobblerResult($Operation, [Type]$ResultType) {
    $gobblerTask = $gobblerAsTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    $gobblerTask.GetAwaiter().GetResult()
}
$gobblerAsAction = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and !$_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.FullName -eq 'Windows.Foundation.IAsyncAction' } | Select-Object -First 1
$gobblerInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
if (@($gobblerInput.pages).Count -lt 1 -or @($gobblerInput.pages).Count -gt 2 -or !$gobblerInput.path) { throw 'Invalid rendering batch' }
$gobblerFile = Wait-GobblerResult ([Windows.Storage.StorageFile]::GetFileFromPathAsync([string]$gobblerInput.path)) ([Windows.Storage.StorageFile])
$gobblerPdf = Wait-GobblerResult ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($gobblerFile)) ([Windows.Data.Pdf.PdfDocument])
$gobblerOutput = @()
foreach ($gobblerNumber in $gobblerInput.pages) {
    if ($gobblerNumber -lt 1 -or $gobblerNumber -gt $gobblerPdf.PageCount) { throw 'Invalid PDF page' }
    $gobblerPage = $gobblerPdf.GetPage([uint32]($gobblerNumber - 1))
    $gobblerStream = [Windows.Storage.Streams.InMemoryRandomAccessStream]::new()
    $gobblerReader = $null
    try {
        $gobblerScale = [Math]::Min(3.125, 1600 / [Math]::Max($gobblerPage.Size.Width, $gobblerPage.Size.Height))
        $gobblerOptions = [Windows.Data.Pdf.PdfPageRenderOptions]::new()
        $gobblerOptions.DestinationWidth = [uint32][Math]::Max(1, [Math]::Floor($gobblerPage.Size.Width * $gobblerScale))
        $gobblerOptions.DestinationHeight = [uint32][Math]::Max(1, [Math]::Floor($gobblerPage.Size.Height * $gobblerScale))
        $gobblerAction = $gobblerAsAction.Invoke($null, @($gobblerPage.RenderToStreamAsync($gobblerStream, $gobblerOptions)))
        $null = $gobblerAction.GetAwaiter().GetResult()
        if ($gobblerStream.Size -gt 8000000) {throw 'Rendered page exceeds local limit'}
        $null = $gobblerStream.Seek(0)
        $gobblerReader = [Windows.Storage.Streams.DataReader]::new($gobblerStream)
        $null = Wait-GobblerResult ($gobblerReader.LoadAsync([uint32]$gobblerStream.Size)) ([uint32])
        $gobblerBytes = [byte[]]::new([int]$gobblerStream.Size)
        $gobblerReader.ReadBytes($gobblerBytes)
        $gobblerOutput += @{page=[int]$gobblerNumber; image=[Convert]::ToBase64String($gobblerBytes)}
    } finally {
        if ($gobblerReader) {$gobblerReader.Dispose()} else {$gobblerStream.Dispose()}
        $gobblerPage.Dispose()
    }
}
[Console]::Write((ConvertTo-Json -InputObject @($gobblerOutput) -Depth 4 -Compress))
