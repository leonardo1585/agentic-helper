// GTH - Git Helper Tool
// Aplicativo desktop que inicia o backend Python e abre o frontend

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::process::{Command, Child};
use std::sync::Mutex;
use tauri::{Manager, State};

struct BackendProcess(Mutex<Option<Child>>);

#[tauri::command]
fn start_backend(state: State<BackendProcess>) -> Result<String, String> {
    let mut backend = state.0.lock().map_err(|e| e.to_string())?;
    
    if backend.is_some() {
        return Ok("Backend já está rodando".to_string());
    }
    
    // Tenta iniciar o sidecar (backend empacotado)
    let child = Command::new("./gth-backend")
        .spawn()
        .or_else(|_| {
            // Fallback: tenta encontrar no diretório de recursos
            Command::new("gth-backend").spawn()
        })
        .map_err(|e| format!("Erro ao iniciar backend: {}", e))?;
    
    *backend = Some(child);
    Ok("Backend iniciado".to_string())
}

#[tauri::command]
fn stop_backend(state: State<BackendProcess>) -> Result<String, String> {
    let mut backend = state.0.lock().map_err(|e| e.to_string())?;
    
    if let Some(mut child) = backend.take() {
        child.kill().map_err(|e| format!("Erro ao parar backend: {}", e))?;
    }
    
    Ok("Backend parado".to_string())
}

fn main() {
    tauri::Builder::default()
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            // Inicia o backend automaticamente
            let handle = app.handle();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(500));
                
                // Tenta iniciar o sidecar
                if let Ok((_rx, _child)) = handle.shell().sidecar("gth-backend")
                    .map(|s| s.spawn())
                    .unwrap_or(Err(tauri::api::Error::Io(std::io::Error::new(
                        std::io::ErrorKind::NotFound,
                        "Sidecar não encontrado"
                    ))))
                {
                    println!("✅ Backend iniciado como sidecar");
                } else {
                    println!("⚠️ Usando backend externo");
                }
            });
            
            Ok(())
        })
        .on_window_event(|event| match event.event() {
            tauri::WindowEvent::CloseRequested { .. } => {
                // Para o backend quando fechar a janela
                let state: State<BackendProcess> = event.window().state();
                if let Ok(mut backend) = state.0.lock() {
                    if let Some(mut child) = backend.take() {
                        let _ = child.kill();
                    }
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![start_backend, stop_backend])
        .run(tauri::generate_context!())
        .expect("erro ao executar aplicativo tauri");
}

