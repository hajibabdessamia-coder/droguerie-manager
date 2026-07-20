# يولّد شهادة توقيع كود ذاتية التوقيع محلية (مرة واحدة، تُعاد نفس الهوية في كل بناء
# لاحق بدل شهادة جديدة عشوائية) — سبب وجودها: أُعيد إنتاج عطل حقيقي على هذا الجهاز
# حيث ترفض سياسة Windows Code Integrity (Smart App Control) تشغيل الملف التنفيذي
# غير الموقَّع تماماً (رسالة الخطأ الحرفية: "did not meet the Enterprise signing
# level requirements"). تأكيد تجريبي: توقيع الملف حتى بشهادة ذاتية التوقيع (غير
# موثوقة الجذر) كافٍ لتجاوز هذا الرفض تماماً — بلا أي تعديل على إعدادات الحماية.
# هذا الحل لا يخفض أمان Windows إطلاقاً: لا يُعطَّل أي شيء، فقط يُضاف توقيع Authenticode
# صالح للملف. يبقى تحذير "ناشر غير معروف" قائماً لعملاء آخرين لا يثقون بهذه الشهادة
# تحديداً — الحل الكامل لتوزيع تجاري يبقى شهادة موقَّعة تجارياً (قرار مؤجَّل سابقاً).
$ErrorActionPreference = 'Stop'

$subject = 'CN=Pharma Manager Desktop'
$pfxPath = Join-Path $PSScriptRoot '..\resources\dev-signing-cert.pfx'
$pfxPassword = 'PharmaManagerDevSigning2026'

$existing = Get-ChildItem 'Cert:\CurrentUser\My' -CodeSigningCert | Where-Object { $_.Subject -eq $subject } | Select-Object -First 1

if (-not $existing) {
  Write-Host "Creating new self-signed code signing certificate..."
  $existing = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $subject `
    -CertStoreLocation 'Cert:\CurrentUser\My' `
    -KeyUsage DigitalSignature `
    -FriendlyName 'Pharma Manager Desktop (self-signed, local trust only)' `
    -NotAfter (Get-Date).AddYears(5)
} else {
  Write-Host "Reusing existing certificate, thumbprint $($existing.Thumbprint)"
}

$securePassword = ConvertTo-SecureString -String $pfxPassword -Force -AsPlainText
Export-PfxCertificate -Cert $existing -FilePath $pfxPath -Password $securePassword | Out-Null

Write-Host "Certificate ready: $pfxPath"
Write-Host "Thumbprint: $($existing.Thumbprint)"
Write-Host ""
Write-Host "IMPORTANT: this certificate is self-signed. Windows will still show an" -ForegroundColor Yellow
Write-Host "'Unknown Publisher' warning to customers who haven't trusted it. To make" -ForegroundColor Yellow
Write-Host "THIS machine fully trust it (removes the warning here), an administrator" -ForegroundColor Yellow
Write-Host "must import the public certificate into the Trusted Root store. Export the" -ForegroundColor Yellow
Write-Host "public cert (no private key) and import it with:" -ForegroundColor Yellow
Write-Host "  Export-Certificate -Cert 'Cert:\CurrentUser\My\$($existing.Thumbprint)' -FilePath pharma-manager-public.cer" -ForegroundColor Yellow
Write-Host "  Import-Certificate -FilePath pharma-manager-public.cer -CertStoreLocation Cert:\LocalMachine\Root  # requires admin" -ForegroundColor Yellow
