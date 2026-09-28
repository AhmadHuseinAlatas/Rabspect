# =============================================================================
# Rapspect - pembuat ikon extension dari file logo sumber
#
# ALAT BANTU BUILD ASET, BUKAN BAGIAN DARI EXTENSION.
# Tidak ada dependency: hanya System.Drawing yang sudah ada di Windows.
#
# MASALAH YANG DISELESAIKAN (README bagian 9)
#   1. File sumber berformat JPEG, jadi tidak punya alpha channel.
#   2. Kotak-kotak abu-abu di dalam badge itu PIKSEL ASLI, bukan transparansi.
#      Kalau dipakai langsung, ikon extension benar-benar berlatar papan catur.
#   3. Chrome butuh empat PNG terpisah: 16, 32, 48, 128.
#
# YANG DILAKUKAN SKRIP INI
#   a. mendeteksi lingkaran badge navy secara otomatis (tidak ada koordinat
#      yang ditulis manual, jadi tetap jalan kalau logo diekspor ulang)
#   b. mengganti piksel papan catur di dalam badge dengan warna solid --rp-cream
#   c. membuat latar di luar badge benar-benar transparan, dengan tepi halus
#   d. memotong persegi dan mengecilkan bertahap (halving) supaya hasil kecil
#      tidak beraliasi
#
# BATAS YANG HARUS KAMU TAHU
#   Ini DOWNSCALE, bukan "penyederhanaan progresif" yang diminta README bagian 9.
#   Ikon 16px hasil pengecilan tetap lebih ramai daripada ikon yang digambar
#   ulang khusus untuk 16px. Untuk versi rilis, seorang desainer masih perlu
#   menggambar varian 16 dan 32 dari file vektor.
#
# CARA PAKAI (dari folder proyek):
#   powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
#   powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1 -Source assets\Rapspect.png
# =============================================================================

param(
  [string]$Source = '',
  [string]$OutDir = 'assets\icons',
  [string]$BrandingDir = 'assets\branding'
)

$ErrorActionPreference = 'Stop'

# Cari file sumber kalau tidak disebut: urutan ini mengikuti kebiasaan penamaan
# di proyek, bukan asumsi acak.
if (-not $Source) {
  foreach ($candidate in @('assets\Rapspect.png', 'assets\Rapspect.jpg', 'Rapspect.png', 'Rapspect.jpg')) {
    if (Test-Path $candidate) { $Source = $candidate; break }
  }
}
if (-not $Source -or -not (Test-Path $Source)) {
  Write-Error "File logo sumber tidak ditemukan. Sebutkan dengan -Source <path>."
}

$SourceFull   = (Resolve-Path $Source).Path
$OutFull      = (New-Item -ItemType Directory -Force -Path $OutDir).FullName
$BrandingFull = (New-Item -ItemType Directory -Force -Path $BrandingDir).FullName

Add-Type -AssemblyName System.Drawing

# Pemrosesan piksel ditulis dalam C# dan dikompilasi di tempat. Alasannya
# praktis: mengulang 4,2 juta piksel di PowerShell murni butuh menit, di C#
# butuh milidetik. Tidak ada paket yang diunduh - compiler-nya bagian dari
# .NET Framework yang sudah ada di Windows.
$cs = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;

public static class RapspectIcons
{
    // Warna brand dari README bagian 6.
    const int CREAM_R = 0xFA, CREAM_G = 0xF0, CREAM_B = 0xDC;

    static int Dist2(int r1,int g1,int b1,int r2,int g2,int b2)
    {
        int dr = r1-r2, dg = g1-g2, db = b1-b2;
        return dr*dr + dg*dg + db*db;
    }

    static bool IsNavy(int r,int g,int b)
    {
        // Dua nilai navy dari README: --rp-navy #1F3A5F dan --rp-navy-deep #16293F.
        // Toleransi 70 cukup lebar untuk menyerap artefak kompresi JPEG tanpa
        // ikut menangkap teal #159FA8 yang jauh lebih hijau.
        return Dist2(r,g,b, 0x1F,0x3A,0x5F) < 70*70
            || Dist2(r,g,b, 0x16,0x29,0x3F) < 70*70;
    }

    public static string Build(string srcPath, string iconDir, string brandingDir)
    {
        StringBuilder log = new StringBuilder();

        using (Bitmap raw = new Bitmap(srcPath))
        {
            int W = raw.Width, H = raw.Height;
            log.AppendLine("sumber      : " + srcPath);
            log.AppendLine("dimensi     : " + W + " x " + H);

            Bitmap src = new Bitmap(W, H, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(src))
            {
                g.CompositingQuality = CompositingQuality.HighQuality;
                g.DrawImage(raw, new Rectangle(0, 0, W, H));
            }

            BitmapData bd = src.LockBits(new Rectangle(0,0,W,H), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            int[] px = new int[W*H];
            Marshal.Copy(bd.Scan0, px, 0, px.Length);

            // ---- 1. warna latar diambil dari sudut, bukan ditulis manual ----
            int c0 = px[0];
            int bgR = (c0>>16)&0xFF, bgG = (c0>>8)&0xFF, bgB = c0&0xFF;
            log.AppendLine("warna latar : #" + bgR.ToString("X2") + bgG.ToString("X2") + bgB.ToString("X2"));

            // ---- 2. temukan lingkaran badge ----
            // Baris navy TERLEBAR di 78% bagian atas gambar adalah garis diameter
            // lingkaran. Batas 78% penting: wordmark "Rapspect" di bawah juga
            // berwarna navy dan akan mengacaukan pengukuran kalau ikut dihitung.
            int limitY = (int)(H * 0.78);
            int bestY = -1, bestMinX = 0, bestMaxX = 0, bestWidth = 0;
            for (int y = 0; y < limitY; y++)
            {
                int minX = -1, maxX = -1;
                int rowBase = y*W;
                for (int x = 0; x < W; x++)
                {
                    int p = px[rowBase + x];
                    if (IsNavy((p>>16)&0xFF, (p>>8)&0xFF, p&0xFF))
                    {
                        if (minX < 0) minX = x;
                        maxX = x;
                    }
                }
                if (minX >= 0 && (maxX - minX) > bestWidth)
                {
                    bestWidth = maxX - minX; bestY = y; bestMinX = minX; bestMaxX = maxX;
                }
            }
            if (bestY < 0 || bestWidth < 50)
            {
                src.UnlockBits(bd);
                return "GAGAL: lingkaran badge navy tidak terdeteksi di file ini.";
            }

            double cx = (bestMinX + bestMaxX) / 2.0;
            double cy = bestY;
            double R  = bestWidth / 2.0;
            log.AppendLine("badge       : pusat (" + Math.Round(cx) + ", " + Math.Round(cy) + ") radius " + Math.Round(R));

            // ---- 3. bersihkan papan catur, buat latar transparan ----
            int cleaned = 0, cleared = 0;
            double rOuter = R * 1.02;
            for (int y = 0; y < H; y++)
            {
                int rowBase = y*W;
                for (int x = 0; x < W; x++)
                {
                    int i = rowBase + x;
                    int p = px[i];
                    int r = (p>>16)&0xFF, g = (p>>8)&0xFF, b = p&0xFF;

                    double dx = x - cx, dy = y - cy;
                    double d = Math.Sqrt(dx*dx + dy*dy);

                    if (d <= rOuter)
                    {
                        // DI DALAM badge: papan catur adalah piksel NETRAL dan
                        // TERANG (putih dan abu-abu muda bergantian). Moncong
                        // onta warna cream punya selisih R-B sekitar 30, gigi
                        // lebih kuning lagi, jadi keduanya tidak ikut tertangkap
                        // oleh ambang netral 22.
                        int max = Math.Max(r, Math.Max(g, b));
                        int min = Math.Min(r, Math.Min(g, b));
                        if ((max - min) <= 22 && max >= 165)
                        {
                            px[i] = unchecked((int)0xFF000000) | (CREAM_R<<16) | (CREAM_G<<8) | CREAM_B;
                            cleaned++;
                        }
                        continue;
                    }

                    // DI LUAR badge: yang mirip warna latar dijadikan transparan.
                    // Tassel berwarna merah/kuning/teal jaraknya jauh dari latar,
                    // jadi tetap utuh walaupun menggantung di luar lingkaran.
                    int dist2 = Dist2(r,g,b, bgR,bgG,bgB);
                    if (dist2 <= 18*18)
                    {
                        px[i] = 0; cleared++;
                    }
                    else if (dist2 < 55*55)
                    {
                        // Zona transisi: alpha dibuat bertahap supaya tepi badge
                        // tidak bergerigi setelah dikecilkan.
                        double t = (Math.Sqrt(dist2) - 18.0) / (55.0 - 18.0);
                        int a = (int)Math.Round(t * 255.0);
                        if (a < 0) a = 0; if (a > 255) a = 255;
                        px[i] = (a<<24) | (r<<16) | (g<<8) | b;
                    }
                }
            }
            log.AppendLine("papan catur : " + cleaned + " piksel diganti cream");
            log.AppendLine("latar       : " + cleared + " piksel dibuat transparan");

            // ---- 4. cari batas bawah tassel ----
            // Tassel menggantung di bawah lingkaran, dan potongan "logo penuh"
            // tidak boleh memotongnya di tengah.
            //
            // Batas persentase tinggi gambar TIDAK dipakai di sini - percobaan
            // pertama memakai 78% dan hasilnya tassel terpotong, karena posisi
            // tassel kebetulan persis di sekitar garis itu. Yang dipakai sekarang
            // adalah celah transparan: setelah latar dibuat transparan, ada pita
            // kosong antara ujung tassel dan wordmark. Begitu ditemukan 30 baris
            // kosong berurutan, itu pasti celahnya, dan pemindaian berhenti -
            // jadi wordmark tidak pernah ikut terhitung berapa pun proporsinya.
            int tasselBottom = (int)(cy + R);
            {
                int lastContent = (int)(cy + R);
                int emptyRun = 0;
                int scanLimit = Math.Min(H, (int)(cy + R * 1.6));
                for (int y = (int)(cy + R * 0.95); y < scanLimit; y++)
                {
                    int rowBase = y*W;
                    bool any = false;
                    for (int x = 0; x < W; x++)
                    {
                        if (((px[rowBase + x] >> 24) & 0xFF) > 24) { any = true; break; }
                    }
                    if (any) { lastContent = y; emptyRun = 0; }
                    else { emptyRun++; if (emptyRun > 30) break; }
                }
                tasselBottom = lastContent;
            }
            log.AppendLine("tassel      : batas bawah y=" + tasselBottom +
                           " (lingkaran berakhir di y=" + (int)(cy + R) + ")");

            Marshal.Copy(px, 0, bd.Scan0, px.Length);
            src.UnlockBits(bd);

            // ---- 5. dua kotak potong ----
            int pad = (int)Math.Round(R * 0.04);

            // Kotak potong SENGAJA tidak dipangkas ke batas gambar. Logo ini
            // lebih tinggi daripada lebar setelah tassel ikut dihitung, jadi
            // memangkasnya ke lebar gambar menghasilkan kotak 1686x1752 - tidak
            // persegi, dan ikonnya jadi gepeng saat digambar ke kanvas persegi.
            // Bagian yang melewati tepi diisi transparan oleh SaveScaled.
            int fullTop  = (int)Math.Round(cy - R) - pad;
            int fullBot  = Math.Max((int)Math.Round(cy + R), tasselBottom) + pad;
            int fullSide = fullBot - fullTop;
            Rectangle cropFull = new Rectangle(
                (int)Math.Round(cx - fullSide/2.0), fullTop, fullSide, fullSide);

            int circSide = (int)Math.Round(2*R) + pad*2;
            Rectangle cropCircle = new Rectangle(
                (int)Math.Round(cx - circSide/2.0), (int)Math.Round(cy - circSide/2.0),
                circSide, circSide);

            log.AppendLine("potong penuh: " + cropFull.ToString());
            log.AppendLine("potong badge: " + cropCircle.ToString());

            // ---- 6. simpan ----
            // 128 dan 48 memakai potongan penuh supaya tassel terlihat.
            // 32 dan 16 memakai potongan badge saja: README bagian 9 menyebut
            // ikon 16 tanpa tassel, dan di ukuran itu tassel memang hanya jadi
            // tiga bintik yang mengaburkan bentuk kepala.
            SaveScaled(src, cropFull,   128, System.IO.Path.Combine(iconDir, "icon128.png"));
            SaveScaled(src, cropFull,    48, System.IO.Path.Combine(iconDir, "icon48.png"));
            SaveScaled(src, cropCircle,  32, System.IO.Path.Combine(iconDir, "icon32.png"));
            SaveScaled(src, cropCircle,  16, System.IO.Path.Combine(iconDir, "icon16.png"));

            // PNG penuh yang sudah bersih: ini yang seharusnya menggantikan file
            // JPEG sebagai aset sumber raster (README bagian 9 poin perbaikan).
            SaveScaled(src, cropFull, 512, System.IO.Path.Combine(brandingDir, "logo-badge-512.png"));

            src.Dispose();
        }
        return log.ToString();
    }

    /// Pengecilan bertahap: selama masih lebih dari 2x target, gambar setengah
    /// ukuran dulu. Bicubic sekali langkah dari 1600px ke 16px membuang terlalu
    /// banyak piksel sekaligus dan hasilnya berbintik.
    static void SaveScaled(Bitmap source, Rectangle crop, int target, string outPath)
    {
        Bitmap cur = new Bitmap(crop.Width, crop.Height, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(cur))
        {
            g.Clear(Color.Transparent);
            // Kotak potong boleh melewati tepi gambar sumber. Yang digambar
            // hanya bagian yang benar-benar ada, diletakkan pada offset yang
            // benar; sisanya tetap transparan. Ini yang menjaga hasil tetap
            // persegi tanpa merusak proporsi.
            Rectangle srcRect = Rectangle.Intersect(crop, new Rectangle(0, 0, source.Width, source.Height));
            if (srcRect.Width > 0 && srcRect.Height > 0)
            {
                Rectangle dstRect = new Rectangle(
                    srcRect.X - crop.X, srcRect.Y - crop.Y, srcRect.Width, srcRect.Height);
                g.CompositingMode = CompositingMode.SourceCopy;
                g.DrawImage(source, dstRect, srcRect, GraphicsUnit.Pixel);
            }
        }

        while (cur.Width / 2 > target)
        {
            int nw = Math.Max(target, cur.Width / 2);
            Bitmap half = new Bitmap(nw, nw, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(half))
            {
                g.Clear(Color.Transparent);
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.CompositingQuality = CompositingQuality.HighQuality;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.DrawImage(cur, new Rectangle(0,0,nw,nw), new Rectangle(0,0,cur.Width,cur.Height), GraphicsUnit.Pixel);
            }
            cur.Dispose();
            cur = half;
        }

        using (Bitmap final = new Bitmap(target, target, PixelFormat.Format32bppArgb))
        {
            using (Graphics g = Graphics.FromImage(final))
            {
                g.Clear(Color.Transparent);
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.CompositingQuality = CompositingQuality.HighQuality;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.DrawImage(cur, new Rectangle(0,0,target,target), new Rectangle(0,0,cur.Width,cur.Height), GraphicsUnit.Pixel);
            }
            final.Save(outPath, ImageFormat.Png);
        }
        cur.Dispose();
    }
}
'@

Add-Type -TypeDefinition $cs -ReferencedAssemblies 'System.Drawing' -ErrorAction Stop

Write-Host ''
Write-Host 'Rapspect - membuat ikon extension' -ForegroundColor Cyan
Write-Host ''
$report = [RapspectIcons]::Build($SourceFull, $OutFull, $BrandingFull)
Write-Host $report

Write-Host 'Hasil:' -ForegroundColor Cyan
Get-ChildItem -Path $OutFull, $BrandingFull -Filter *.png |
  Sort-Object Name |
  ForEach-Object { Write-Host ("  {0,-24} {1,8} byte" -f $_.Name, $_.Length) }

Write-Host ''
Write-Host 'Ingat: ini hasil pengecilan, bukan penyederhanaan progresif.' -ForegroundColor Yellow
Write-Host 'README bagian 9 tetap meminta varian 16 dan 32 digambar ulang dari vektor.' -ForegroundColor Yellow
