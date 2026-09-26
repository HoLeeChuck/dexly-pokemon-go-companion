# Resize full-size Archives originals to the 256px width used by the rest of the artwork.
# Windows PowerShell with System.Drawing (built in); keeps transparency. Updates nothing else:
# run `node scripts/sync-form-artwork.mjs --refresh-hashes` afterwards to record new checksums.
param(
  [Parameter(Mandatory = $true)][string[]] $Files,
  [int] $Width = 256
)
Add-Type -AssemblyName System.Drawing
foreach ($file in $Files) {
  $source = [System.Drawing.Image]::FromFile($file)
  try {
    if ($source.Width -le $Width) { continue }
    $height = [int][Math]::Round($source.Height * $Width / $source.Width)
    $target = New-Object System.Drawing.Bitmap $Width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($target)
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $attributes = New-Object System.Drawing.Imaging.ImageAttributes
    $attributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
    $g.DrawImage($source, (New-Object System.Drawing.Rectangle 0, 0, $Width, $height), 0, 0, $source.Width, $source.Height, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
    $g.Dispose()
  } finally {
    $source.Dispose()
  }
  $target.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $target.Dispose()
}
