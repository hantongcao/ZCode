$vi = [System.Diagnostics.FileVersionInfo]::GetVersionInfo("C:\cht\code\ZCode\packages\desktop\dist\XunguAgent-3.16.2-win-x64.exe")
Write-Output "ProductName: $($vi.ProductName)"
Write-Output "FileDescription: $($vi.FileDescription)"
Write-Output "CompanyName: $($vi.CompanyName)"
Write-Output "ProductVersion: $($vi.ProductVersion)"
