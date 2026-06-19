# Servidor Web local en PowerShell para evitar problemas de CORS con módulos JS
$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try {
    $listener.Start()
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host " Servidor local del juego iniciado en:" -ForegroundColor Green
    Write-Host " http://localhost:$port/" -ForegroundColor Cyan
    Write-Host " (Cierra esta ventana para detener el servidor)" -ForegroundColor Yellow
    Write-Host "==================================================" -ForegroundColor Green
    
    # Abrir el juego automáticamente en el navegador predeterminado
    Start-Process "http://localhost:$port/"

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/") {
            $urlPath = "/index.html"
        }

        # Resolver ruta física
        $filePath = Join-Path (Get-Location) $urlPath.Replace("/", "\")

        if (Test-Path $filePath -PathType Leaf) {
            $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
            switch ($extension) {
                ".html" { $response.ContentType = "text/html; charset=utf-8" }
                ".js"   { $response.ContentType = "application/javascript; charset=utf-8" }
                ".css"  { $response.ContentType = "text/css; charset=utf-8" }
                ".json" { $response.ContentType = "application/json; charset=utf-8" }
                ".png"  { $response.ContentType = "image/png" }
                ".jpg"  { $response.ContentType = "image/jpeg" }
                ".jpeg" { $response.ContentType = "image/jpeg" }
                ".gif"  { $response.ContentType = "image/gif" }
                ".svg"  { $response.ContentType = "image/svg+xml" }
                default { $response.ContentType = "application/octet-stream" }
            }

            try {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                $response.StatusCode = 500
                $errMsg = [System.Text.Encoding]::UTF8.GetBytes("Error interno del servidor al leer el archivo.")
                $response.OutputStream.Write($errMsg, 0, $errMsg.Length)
            }
        } else {
            $response.StatusCode = 404
            $notFoundMsg = [System.Text.Encoding]::UTF8.GetBytes("Archivo no encontrado: $urlPath")
            $response.OutputStream.Write($notFoundMsg, 0, $notFoundMsg.Length)
        }
        $response.OutputStream.Close()
    }
} catch {
    Write-Host "Error al iniciar el servidor: $_" -ForegroundColor Red
} finally {
    if ($listener) {
        $listener.Close()
    }
}
