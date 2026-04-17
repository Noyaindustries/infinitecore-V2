Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('F:\infinitecoreV2\public\infinite-core-logo-v2.png')
"{0} x {1}" -f $img.Width, $img.Height
$img.Dispose()
