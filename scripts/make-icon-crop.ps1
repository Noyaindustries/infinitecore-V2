# Crée `public/infinite-core-icon.png` — version carrée du logo Infinite Core
# contenant uniquement le symbole d'infini (partie gauche), avec le fond bleu marine d'origine.
# Objectif : avoir un favicon lisible à 16/32 px, où le texte du logo serait illisible.

Add-Type -AssemblyName System.Drawing

$sourcePath = 'F:\infinitecoreV2\public\infinite-core-logo-v2.png'
$targetPath = 'F:\infinitecoreV2\public\infinite-core-icon.png'

$src = [System.Drawing.Image]::FromFile($sourcePath)
Write-Host "Source : $($src.Width) x $($src.Height)"

# Le symbole d'infini occupe ~x in [140, 560] horizontalement (logo 1024x677).
# On recentre un carré de 560 px côté sur le symbole.
$cropX = 140
$cropY = 0
$cropSide = 560
if ($cropY + $cropSide -gt $src.Height) { $cropY = [math]::Max(0, ($src.Height - $cropSide) / 2) }

$srcRect = New-Object System.Drawing.Rectangle $cropX, $cropY, $cropSide, $cropSide

$targetSide = 512
$dst = New-Object System.Drawing.Bitmap $targetSide, $targetSide
$graphics = [System.Drawing.Graphics]::FromImage($dst)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Peint d'abord le fond bleu marine (ne laisse aucune bande blanche si le crop dépasse).
$bg = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#2B547E'))
$graphics.FillRectangle($bg, 0, 0, $targetSide, $targetSide)

$dstRect = New-Object System.Drawing.Rectangle 0, 0, $targetSide, $targetSide
$graphics.DrawImage($src, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$dst.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$dst.Dispose()
$bg.Dispose()
$src.Dispose()

Write-Host "Icône générée : $targetPath ($targetSide x $targetSide)"
