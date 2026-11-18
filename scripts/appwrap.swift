// Casca nativa da casa: janela própria (WKWebView) que sobe o servidor local,
// ESPERA ele responder e então mostra a tela — sem browser, sem terminal.
// Menu de verdade: Recarregar (Cmd+R), Copiar/Colar, Sair, Fechar.
// Parametrizado por env (LSEnvironment) para servir os dois apps:
//   APP_TITULO   título da janela
//   APP_PORTA    porta local (ex.: 8777 Financeiro, 4173 Previsão)
//   APP_CMD      executável do servidor (ex.: /usr/bin/python3, ou /bin/bash)
//   APP_ARGS     argumentos separados por | (ex.: "servidor.py")
//   APP_PORTAENV nome da env var de porta a passar ao filho (ex.: PORTA); vazio = não passa
//   APP_PATH     PATH extra para achar node/npx (Homebrew); vazio = herda
//   APP_MARCA    pedaços de texto que a resposta do NOSSO servidor tem, separados
//                por | . Vazio = usa o padrão embutido, que serve aos dois apps.
//                Ver quemEstaNaPorta().
import Cocoa
import WebKit

let env = ProcessInfo.processInfo.environment
let TITULO = env["APP_TITULO"] ?? "Financeiro do Grupo"
let PORTA  = Int(env["APP_PORTA"] ?? "8777") ?? 8777
let CMD    = env["APP_CMD"] ?? "/usr/bin/python3"
let ARGS   = (env["APP_ARGS"] ?? "servidor.py").split(separator: "|").map(String.init)
let PORTAENV = env["APP_PORTAENV"] ?? ""
let PATHEXTRA = env["APP_PATH"] ?? ""
// Backup ao SAIR (Marco 24/07/2026): quando APP_BACKUP_DIR está setado (Planejador),
// ao fechar pedimos o JSON a window.__backupAoSair() e gravamos um arquivo local
// nessa pasta (mantendo os 15 mais recentes). Vazio (Financeiro) = nada a gravar
// aqui; lá o próprio servidor faz o backup ao receber o SIGTERM.
let BACKUPDIR = env["APP_BACKUP_DIR"] ?? ""
let BACKUPPREFIXO = env["APP_BACKUP_PREFIXO"] ?? "backup"
let URLSTR = "http://localhost:\(PORTA)/"

// Marcas que identificam a resposta do NOSSO servidor. As embutidas estão no HTML
// dos dois apps (o Planejador serve dist/index.html, o Financeiro serve
// static/index.html), então nenhum Info.plist precisa mudar para isto valer.
// Basta UMA bater. É de propósito generoso: acusar à toa deixaria o Marco sem app.
let MARCAS: [String] = {
    let m = env["APP_MARCA"] ?? ""
    return m.isEmpty ? ["lang=\"pt-BR\"", "id=\"root\""] : m.split(separator: "|").map(String.init)
}()

// A PASTA DE ONDE ESTAMOS SERVINDO. É a pasta que contém o .app, e era o dado que
// faltava na tela: quando existe mais de uma cópia do app na máquina (todas com o
// mesmo CFBundleIdentifier), o macOS abre a que ele resolveu por último, e sem isto
// escrito não há como saber qual foi. Medido em 27/07/2026: quatro cópias do
// Planejador no Desktop, e o Dock abria a que não tinha node_modules.
#if TESTE_CASCA
let RAIZ = env["TESTE_RAIZ"] ?? (Bundle.main.bundlePath as NSString).deletingLastPathComponent
#else
let RAIZ = (Bundle.main.bundlePath as NSString).deletingLastPathComponent
#endif
let PASTANOME = (RAIZ as NSString).lastPathComponent
let LOGCAMINHO = RAIZ + "/servidor.log"

// Conecta em "localhost" deixando o SISTEMA resolver o endereço — exatamente o
// mesmo caminho que a janela usa para carregar http://localhost:PORTA/ . Isso
// importa: medido em 27/07/2026 nesta máquina, `vite preview` escuta SÓ em ::1
// (IPv6), então quem procura o servidor só em 127.0.0.1 não acha um servidor que
// está lá, saudável. Se a janela alcança, esta função alcança.
private func conectarEm(_ host: String, _ port: Int) -> Int32? {
    var dicas = addrinfo(ai_flags: 0, ai_family: AF_UNSPEC, ai_socktype: SOCK_STREAM,
                         ai_protocol: IPPROTO_TCP, ai_addrlen: 0,
                         ai_canonname: nil, ai_addr: nil, ai_next: nil)
    var lista: UnsafeMutablePointer<addrinfo>?
    guard getaddrinfo(host, String(port), &dicas, &lista) == 0, lista != nil else { return nil }
    defer { freeaddrinfo(lista) }
    var no = lista
    while let atual = no {
        let s = socket(atual.pointee.ai_family, atual.pointee.ai_socktype, atual.pointee.ai_protocol)
        if s >= 0 {
            var um: Int32 = 1
            setsockopt(s, SOL_SOCKET, SO_NOSIGPIPE, &um, socklen_t(MemoryLayout<Int32>.size))
            if connect(s, atual.pointee.ai_addr, atual.pointee.ai_addrlen) == 0 { return s }
            close(s)
        }
        no = atual.pointee.ai_next
    }
    return nil
}

private func conectarLocalhost(_ port: Int) -> Int32? {
    // "localhost" primeiro, e os dois endereços numéricos depois, como rede de
    // segurança: se um dia o nome "localhost" parar de resolver nesta máquina, a
    // casca ainda acha o próprio servidor em vez de dizer que ele não subiu.
    for host in ["localhost", "::1", "127.0.0.1"] {
        if let s = conectarEm(host, port) { return s }
    }
    return nil
}

// Quem está atendendo na porta: ninguém, o nosso app, ou um estranho.
enum NaPorta { case ninguem, nosso, estranho }

// Uma requisição HTTP curta, com prazo, só para ver QUEM responde. Antes a casca
// só perguntava "tem alguém aí?" — e, se tivesse, não subia servidor nenhum e
// ficava 40 segundos esperando um servidor que podia não ser dela.
func quemEstaNaPorta(_ port: Int) -> NaPorta {
    guard let s = conectarLocalhost(port) else { return .ninguem }
    defer { close(s) }
    var prazo = timeval(tv_sec: 3, tv_usec: 0)
    setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, &prazo, socklen_t(MemoryLayout<timeval>.size))
    setsockopt(s, SOL_SOCKET, SO_SNDTIMEO, &prazo, socklen_t(MemoryLayout<timeval>.size))
    let pedido = "GET / HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n"
    let bytes = Array(pedido.utf8)
    if send(s, bytes, bytes.count, 0) < 0 { return .estranho }
    var dados = Data()
    var pedaco = [UInt8](repeating: 0, count: 4096)
    while dados.count < 65536 {
        let n = recv(s, &pedaco, pedaco.count, 0)
        if n <= 0 { break }
        dados.append(contentsOf: pedaco[0..<n])
    }
    // Conectou mas não falou HTTP (ou não falou nada): é alguém, e não é o app.
    let texto = String(decoding: dados, as: UTF8.self)
    guard texto.hasPrefix("HTTP/") else { return .estranho }
    for marca in MARCAS where texto.contains(marca) { return .nosso }
    return .estranho
}

// "Já tem alguém servindo?" — usado só DEPOIS que nós mesmos subimos o servidor,
// quando a identidade já não está em dúvida e só falta ele começar a atender.
func portaResponde(_ port: Int) -> Bool { quemEstaNaPorta(port) != .ninguem }

// —— servidor.log: nunca vazio, e sempre dizendo de onde estamos servindo ——
func agoraTexto() -> String {
    let f = DateFormatter(); f.dateFormat = "dd/MM/yyyy HH:mm:ss"
    return f.string(from: Date())
}

@discardableResult
func anexarAoLog(_ linha: String) -> Bool {
    guard let d = "[\(agoraTexto())] \(linha)\n".data(using: .utf8) else { return false }
    if !FileManager.default.fileExists(atPath: LOGCAMINHO) {
        return FileManager.default.createFile(atPath: LOGCAMINHO, contents: d)
    }
    guard let fh = FileHandle(forWritingAtPath: LOGCAMINHO) else { return false }
    defer { try? fh.close() }
    fh.seekToEndOfFile()
    do { try fh.write(contentsOf: d) } catch { return false }
    return true
}

// Tira as cores de terminal (ESC[32m…) para o texto do log caber numa tela.
private func semCores(_ s: String) -> String {
    var saida = ""
    var pulando = false
    for c in s {
        if pulando { if c.isLetter { pulando = false }; continue }
        if c == "\u{1B}" { pulando = true; continue }
        saida.append(c)
    }
    return saida
}

func ultimasLinhasDoLog(_ quantas: Int) -> String? {
    guard let t = try? String(contentsOfFile: LOGCAMINHO, encoding: .utf8) else { return nil }
    let linhas = semCores(t)
        .split(separator: "\n", omittingEmptySubsequences: false)
        .map { $0.trimmingCharacters(in: .whitespaces) }
        .filter { !$0.isEmpty }
    if linhas.isEmpty { return nil }
    return linhas.suffix(quantas).joined(separator: "\n")
}

private func existe(_ caminho: String) -> Bool {
    FileManager.default.fileExists(atPath: caminho)
}

func htmlSeguro(_ s: String) -> String {
    s.replacingOccurrences(of: "&", with: "&amp;")
        .replacingOccurrences(of: "<", with: "&lt;")
        .replacingOccurrences(of: ">", with: "&gt;")
}

// O título da janela traz o NOME da pasta servida. É o único lugar que continua
// visível depois de o app carregar, e era exatamente o que faltava para distinguir
// "Planejador servindo previsao-eventos" de "Planejador servindo h4a-copia" —
// cópias que o macOS trata como o mesmo app.
let TITULOJANELA = "\(TITULO) — \(PASTANOME)"

// A tela de "Abrindo…" também DIZ de qual pasta o app está servindo, com o caminho
// inteiro. Sem isso, quando o macOS abre outra cópia do mesmo app, nada na tela
// conta qual delas é. Mora numa função, e não solta dentro da janela, para que
// scripts/testar-casca.sh confira ESTE texto — e não uma cópia dele.
func htmlAbrindo() -> String {
    """
    <html><head><meta name='viewport' content='width=device-width,initial-scale=1'>
    <style>html,body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:18px;
    background:#f0ebe7;color:#6c675e;font:15px -apple-system,system-ui,sans-serif}
    @media(prefers-color-scheme:dark){html,body{background:#1b1916;color:#b7b1a5}}
    .w{display:flex;align-items:center;gap:11px}.d{width:15px;height:15px;border-radius:50%;
    background:#0045dd;animation:p 1.1s ease-in-out infinite}
    .p{font-size:12px;opacity:.62;text-align:center;line-height:1.5;max-width:80vw;
    word-break:break-all}.p b{font-weight:600}
    @keyframes p{0%,100%{opacity:.25;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}</style>
    </head><body><div class='w'><span class='d'></span>Abrindo o \(htmlSeguro(TITULO))…</div>
    <div class='p'>servindo a pasta<br><b>\(htmlSeguro(RAIZ))</b></div></body></html>
    """
}

class Delegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler {
    var win: NSWindow!
    var web: WKWebView!
    var servidor: Process?
    var motivoFalha: String?

    func applicationDidFinishLaunching(_ n: Notification) {
        montarMenu()
        // abre preenchendo a tela (Marco 23/07: "os dois apps abrem em fullscreen").
        // visibleFrame = tela menos a barra de menu e o Dock, então nada fica escondido.
        let tela = NSScreen.main?.visibleFrame ?? NSMakeRect(0, 0, 1440, 900)
        win = NSWindow(contentRect: tela,
                       styleMask: [.titled, .closable, .miniaturizable, .resizable],
                       backing: .buffered, defer: false)
        win.title = TITULOJANELA
        win.setFrame(tela, display: true)
        let cfg = WKWebViewConfiguration()
        // —— IMPRIMIR / SALVAR PDF (Marco, 27/07/2026: "salvar pdf não tá
        // funcionando"). O botão "Relatório / PDF" do app chama window.print(),
        // e num WKWebView isso NÃO FAZ NADA: a janela não tem impressão a menos
        // que o app a implemente. No navegador funcionava; na casca do Dock,
        // não — e sem erro nenhum, que é o pior jeito de falhar.
        //
        // A ponte troca window.print por um recado para cá, e o lado nativo abre
        // o diálogo de impressão do macOS (onde mora o "Salvar como PDF"). O
        // JavaScript do app segue rodando igual — inclusive o truque dele de
        // trocar o document.title para sugerir o nome do arquivo (ReportView.jsx,
        // sugestão 41), que é justamente o que o diálogo lê.
        cfg.userContentController.add(self, name: "imprimir")
        cfg.userContentController.addUserScript(WKUserScript(
            source: "window.print = function () { window.webkit.messageHandlers.imprimir.postMessage(document.title) }",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false))
        web = WKWebView(frame: win.contentView!.bounds, configuration: cfg)
        web.autoresizingMask = [.width, .height]
        web.navigationDelegate = self
        web.uiDelegate = self   // sem isto, alert/confirm/prompt/arquivo NÃO funcionam
        if #available(macOS 13.3, *) { web.isInspectable = true }  // clique-direito → Inspecionar
        win.contentView!.addSubview(web)
        win.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        // tela de carregamento enquanto o servidor sobe (o boot faz backup e leva
        // alguns segundos) — janela em branco parece travada; isto parece um app.
        web.loadHTMLString(htmlAbrindo(), baseURL: nil)

        DispatchQueue.global().async {
            let desfecho = self.decidirArranque()
            DispatchQueue.main.async {
                switch desfecho {
                case .carregar(let endereco):
                    self.web.load(URLRequest(url: URL(string: endereco)!))
                case .falhar(let texto):
                    self.mostrarFalha(texto)
                }
            }
        }
    }

    enum Desfecho { case carregar(String), falhar(String) }

    // TODO o arranque, sem tocar em janela nenhuma: descobre quem está na porta,
    // sobe o servidor se ela estiver livre, espera, e devolve OU o endereço a
    // carregar OU o texto exato da falha. Separado da tela de propósito, para que
    // scripts/testar-casca.sh exercite esta função — e não uma cópia dela.
    func decidirArranque() -> Desfecho {
        var quem = quemEstaNaPorta(PORTA)
        // Segunda chance antes de acusar: um servidor nosso que acabou de subir
        // pode responder torto por um instante, e acusar à toa deixaria o Marco
        // sem app. Só um "estranho" duas vezes seguidas vira aviso.
        if quem == .estranho {
            usleep(1_200_000)
            quem = quemEstaNaPorta(PORTA)
        }
        // Caso do dia a dia: servidor DELE mesmo já na porta (app já aberto, ou
        // sobra de uma sessão anterior). Carrega na hora, sem subir outro e sem
        // aviso nenhum.
        if quem == .nosso {
            anexarAoLog("porta \(PORTA) já estava atendida pelo próprio \(TITULO) — não subi outro servidor")
            return .carregar(URLSTR)
        }
        if quem == .estranho {
            anexarAoLog("porta \(PORTA) ocupada por outro programa — não subi servidor nenhum")
            return .falhar(textoPortaOcupada())
        }
        subirServidor()
        // Se o comando nem começou a rodar, o motivo já está na mão: esperar 40
        // segundos por um servidor que não existe só atrasa a má notícia.
        if motivoFalha != nil { return .falhar(textoNaoSubiu()) }
        // Prazo por RELÓGIO, não por número de voltas: uma volta pode demorar
        // (quem aceita a conexão e não responde segura 3s), e contar voltas
        // transformaria os 40 segundos prometidos em muitos minutos.
        let limite = Date().addingTimeInterval(40)
        while Date() < limite {
            // Daqui em diante quem está na porta é o servidor que NÓS subimos —
            // não se acusa mais ninguém de estranho, só se espera ele atender.
            if portaResponde(PORTA) { return .carregar(URLSTR) }
            // Se o servidor morreu antes de atender, não faz sentido esperar os
            // 40s: o motivo já está no servidor.log e vai para a tela agora.
            if let s = servidor, !s.isRunning { break }
            usleep(300_000)
        }
        if portaResponde(PORTA) { return .carregar(URLSTR) }
        return .falhar(textoNaoSubiu())
    }

    func subirServidor() {
        // O log recomeça a cada abertura, mas a PRIMEIRA linha já diz a data, a
        // pasta, a porta e o comando. Antes ele era criado VAZIO, e um
        // servidor.log vazio não contava nada a quem a mensagem mandava olhar.
        try? FileManager.default.removeItem(atPath: LOGCAMINHO)
        anexarAoLog("abrindo o \(TITULO) · pasta \(RAIZ) · porta \(PORTA) · comando \(CMD) \(ARGS.joined(separator: " "))")
        let p = Process()
        p.executableURL = URL(fileURLWithPath: CMD.hasPrefix("/") ? CMD : "/usr/bin/env")
        p.arguments = CMD.hasPrefix("/") ? ARGS : ([CMD] + ARGS)
        p.currentDirectoryURL = URL(fileURLWithPath: RAIZ)
        var e = ProcessInfo.processInfo.environment
        if !PATHEXTRA.isEmpty { e["PATH"] = PATHEXTRA + ":" + (e["PATH"] ?? "") }
        if !PORTAENV.isEmpty { e[PORTAENV] = String(PORTA) }
        p.environment = e
        if let fh = FileHandle(forWritingAtPath: LOGCAMINHO) {
            fh.seekToEndOfFile()
            p.standardOutput = fh; p.standardError = fh
        }
        do { try p.run(); servidor = p }
        catch {
            // O motivo REAL ia para o log do sistema (NSLog), que ninguém abre,
            // enquanto a tela mandava olhar um servidor.log que podia nem existir.
            // Agora vai para os DOIS lugares, e a tela conta se o arquivo existe.
            let motivo = "não consegui executar \(CMD): \(error.localizedDescription)"
            motivoFalha = motivo
            anexarAoLog(motivo)
        }
    }

    // —— Os textos das duas falhas, em português, com a pasta e a porta ——
    func textoPortaOcupada() -> String {
        """
        O \(TITULO) não abriu: a porta \(PORTA) está ocupada por outro programa.

        Quem atendeu na porta \(PORTA) respondeu, mas não é o \(TITULO) — então eu não subi servidor nenhum e não fiquei esperando. Abrir assim mostraria a tela de outro programa como se fosse a sua.

        Estou servindo a pasta:
        \(RAIZ)

        O que fazer: feche o programa que está usando a porta \(PORTA) e abra o \(TITULO) de novo. Se não souber qual é, reiniciar o Mac resolve.
        """
    }

    func textoNaoSubiu() -> String {
        var partes: [String] = ["O \(TITULO) não abriu.", "Estou servindo a pasta:\n\(RAIZ)"]
        if let m = motivoFalha {
            partes.append("Motivo: \(m)")
        } else if let s = servidor, !s.isRunning {
            partes.append("Motivo: o servidor encerrou sozinho, sem chegar a atender na porta \(PORTA). Código de saída \(s.terminationStatus).")
        } else {
            var m = "Motivo: o servidor não atendeu na porta \(PORTA) em 40 segundos."
            if !existe(RAIZ + "/node_modules") {
                m += " Essa pasta não tem a pasta node_modules, então ele começou instalando as dependências — isso demora muito mais que 40 segundos."
            } else if !existe(RAIZ + "/dist/index.html") {
                m += " Essa pasta não tem dist/index.html, então ele começou montando o app antes de servir."
            }
            partes.append(m)
        }
        if let fim = ultimasLinhasDoLog(8) {
            partes.append("Últimas linhas do servidor.log, na pasta acima:\n\(fim)")
        } else if existe(LOGCAMINHO) {
            partes.append("O servidor.log está nessa pasta, mas está vazio.")
        } else {
            partes.append("Não existe servidor.log nessa pasta — não adianta procurar por ele.")
        }
        return partes.joined(separator: "\n\n")
    }

    // A falha aparece na JANELA (dá para ler e copiar depois de fechar o aviso) e
    // também no aviso do sistema.
    func mostrarFalha(_ texto: String) {
        web.loadHTMLString("""
        <html><head><meta name='viewport' content='width=device-width,initial-scale=1'>
        <style>html,body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
        background:#f0ebe7;color:#3a3630;font:14px/1.6 -apple-system,system-ui,sans-serif}
        @media(prefers-color-scheme:dark){html,body{background:#1b1916;color:#d6d0c4}}
        .c{max-width:640px;padding:32px}h1{font-size:17px;margin:0 0 18px;color:#a8331f}
        pre{white-space:pre-wrap;word-break:break-word;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;
        margin:0;user-select:text}</style></head><body><div class='c'>
        <h1>O \(htmlSeguro(TITULO)) não abriu</h1><pre>\(htmlSeguro(texto))</pre></div></body></html>
        """, baseURL: nil)
        avisar(texto)
    }

    // Menu nativo: sem ele, nem Cmd+R, nem Copiar/Colar, nem Cmd+Q funcionam.
    func montarMenu() {
        let main = NSMenu()
        func sub(_ titulo: String) -> NSMenu {
            let item = NSMenuItem(); main.addItem(item)
            let m = NSMenu(title: titulo); item.submenu = m; return m
        }
        // App
        let app = sub(TITULO)
        app.addItem(withTitle: "Ocultar \(TITULO)", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        app.addItem(NSMenuItem.separator())
        app.addItem(withTitle: "Sair", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        // Editar (faz Copiar/Colar/Selecionar tudo funcionarem nos campos da tela)
        let ed = sub("Editar")
        ed.addItem(withTitle: "Desfazer", action: Selector(("undo:")), keyEquivalent: "z")
        ed.addItem(withTitle: "Refazer", action: Selector(("redo:")), keyEquivalent: "Z")
        ed.addItem(NSMenuItem.separator())
        ed.addItem(withTitle: "Recortar", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        ed.addItem(withTitle: "Copiar", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        ed.addItem(withTitle: "Colar", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        ed.addItem(withTitle: "Selecionar tudo", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        // Ver — RECARREGAR
        let ver = sub("Ver")
        let imp = NSMenuItem(title: "Imprimir / Salvar PDF…", action: #selector(imprimir(_:)), keyEquivalent: "p"); imp.target = self
        ver.addItem(imp)
        ver.addItem(NSMenuItem.separator())
        let r = NSMenuItem(title: "Recarregar", action: #selector(recarregar), keyEquivalent: "r"); r.target = self
        ver.addItem(r)
        let rf = NSMenuItem(title: "Forçar recarga", action: #selector(recarregarForte), keyEquivalent: "R")
        rf.keyEquivalentModifierMask = [.command, .shift]; rf.target = self
        ver.addItem(rf)
        // Janela
        let jan = sub("Janela")
        jan.addItem(withTitle: "Minimizar", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        jan.addItem(withTitle: "Ampliar", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        jan.addItem(withTitle: "Fechar", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        NSApp.mainMenu = main
        NSApp.windowsMenu = jan
    }
    @objc func recarregar() { web.reload() }
    @objc func recarregarForte() { web.reloadFromOrigin() }

    // —— A ponte de impressão chega aqui (ver o userScript lá em cima).
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "imprimir" else { return }
        imprimir(nil)
    }

    // Abre o diálogo de impressão do macOS sobre a janela. É de lá que sai o
    // "Salvar como PDF" que o Marco procurava. Serve os dois caminhos: o botão
    // do app (via ponte) e o Cmd+P do menu.
    @objc func imprimir(_ sender: Any?) {
        guard let w = web, let janela = w.window else { return }
        let info = NSPrintInfo.shared
        info.horizontalPagination = .fit
        info.isHorizontallyCentered = true
        info.isVerticallyCentered = false
        let op = w.printOperation(with: info)
        op.showsPrintPanel = true
        op.showsProgressPanel = true
        op.runModal(for: janela, delegate: nil, didRun: nil, contextInfo: nil)
    }

    // —— WKUIDelegate: sem estes, alert/confirm/prompt/arquivo do site não fazem
    // NADA (o confirm() retorna "cancelar" sozinho e todo botão que pergunta
    // "confirma?" morre em silêncio). Sheets no lugar de runModal p/ não travar
    // o processo do WebKit. ——
    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert(); a.messageText = TITULO; a.informativeText = message; a.addButton(withTitle: "OK")
        a.beginSheetModal(for: win) { _ in completionHandler() }
    }
    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert(); a.messageText = TITULO; a.informativeText = message
        a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancelar")
        a.beginSheetModal(for: win) { r in completionHandler(r == .alertFirstButtonReturn) }
    }
    func webView(_ w: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let a = NSAlert(); a.messageText = TITULO; a.informativeText = prompt
        a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancelar")
        let tf = NSTextField(frame: NSRect(x: 0, y: 0, width: 320, height: 24)); tf.stringValue = defaultText ?? ""
        a.accessoryView = tf
        a.beginSheetModal(for: win) { r in completionHandler(r == .alertFirstButtonReturn ? tf.stringValue : nil) }
    }
    func webView(_ w: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let p = NSOpenPanel()
        p.allowsMultipleSelection = parameters.allowsMultipleSelection
        p.canChooseFiles = true; p.canChooseDirectories = false
        p.beginSheetModal(for: win) { r in completionHandler(r == .OK ? p.urls : nil) }
    }
    // —— Downloads (exportar CSV / backup JSON) ——
    func webView(_ w: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
    }
    func webView(_ w: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }
    func webView(_ w: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let p = NSSavePanel(); p.nameFieldStringValue = suggestedFilename; p.canCreateDirectories = true
        p.beginSheetModal(for: win) { r in
            guard r == .OK, let url = p.url else { completionHandler(nil); return }
            try? FileManager.default.removeItem(at: url)  // WKDownload exige destino inexistente
            completionHandler(url)
        }
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        avisar("O download não completou: \(error.localizedDescription)")
    }

    func avisar(_ msg: String) {
        let a = NSAlert(); a.messageText = TITULO; a.informativeText = msg; a.runModal()
    }
    // —— Sair: salvar + backup ao fechar (Marco 24/07/2026) ——
    // No "Sair"/Cmd+Q (ou fechar a última janela) adiamos o encerramento para:
    //  1) BACKUP DO WEB (Planejador): a tela guarda os dados no navegador, então
    //     pedimos o JSON a window.__backupAoSair() e gravamos um arquivo local em
    //     APP_BACKUP_DIR (rotação: 15 mais recentes). Vazio (Financeiro) = pula.
    //  2) ENCERRAR O SERVIDOR COM CALMA: mandamos SIGTERM e esperamos ele sair —
    //     o Financeiro faz o próprio backup do banco nesse SIGTERM (servidor.py).
    // Um teto de 6s garante que o Sair NUNCA trava, mesmo se algo pendurar.
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        var respondeu = false
        let responder = {
            if !respondeu {
                respondeu = true
                DispatchQueue.main.async { NSApp.reply(toApplicationShouldTerminate: true) }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { responder() }  // teto: Sair nunca trava
        DispatchQueue.global().async {
            // 1) backup do web (só quando há pasta configurada — Planejador)
            if !BACKUPDIR.isEmpty {
                let grupo = DispatchGroup()
                grupo.enter()
                DispatchQueue.main.async {
                    if #available(macOS 11.0, *), let w = self.web {
                        w.callAsyncJavaScript(
                            "return (window.__backupAoSair ? await window.__backupAoSair() : '')",
                            arguments: [:], in: nil, in: .page) { resultado in
                            if case .success(let valor) = resultado,
                               let json = valor as? String, !json.isEmpty {
                                self.gravarBackup(json)
                            }
                            grupo.leave()
                        }
                    } else { grupo.leave() }
                }
                _ = grupo.wait(timeout: .now() + 4)
            }
            // 2) encerra o servidor e espera ele sair (Financeiro faz backup no SIGTERM)
            if let s = self.servidor, s.isRunning {
                s.terminate()
                let prazo = Date().addingTimeInterval(4)
                while s.isRunning && Date() < prazo { usleep(100_000) }
            }
            responder()
        }
        return .terminateLater
    }

    // Grava o JSON do web num arquivo datado na pasta do repo e mantém só os 15
    // mais recentes do MESMO prefixo (arquivos de outro nome, guardados à mão,
    // nunca são apagados).
    func gravarBackup(_ json: String) {
        let dir = RAIZ + "/" + BACKUPDIR
        try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd-HHmmss"
        let caminho = dir + "/\(BACKUPPREFIXO)-\(fmt.string(from: Date())).json"
        do { try json.write(toFile: caminho, atomically: true, encoding: .utf8) }
        catch { NSLog("backup ao sair não gravou: \(error)") }
        if let itens = try? FileManager.default.contentsOfDirectory(atPath: dir) {
            let meus = itens
                .filter { $0.hasPrefix(BACKUPPREFIXO + "-") && $0.hasSuffix(".json") }
                .sorted()
            for velho in meus.dropLast(15) {
                try? FileManager.default.removeItem(atPath: dir + "/" + velho)
            }
        }
    }

    func applicationWillTerminate(_ n: Notification) { servidor?.terminate() }
    func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { true }
}

#if TESTE_CASCA
// Modo de prova, compilado SÓ por scripts/testar-casca.sh (-D TESTE_CASCA): roda
// o MESMO decidirArranque() do app, sem janela nenhuma, e imprime o texto exato
// que iria para a tela. O binário do app não tem nada disto dentro.
setbuf(stdout, nil)
let prova = Delegate()
let inicio = Date()
let desfecho = prova.decidirArranque()
let gastou = String(format: "%.1fs", Date().timeIntervalSince(inicio))
switch desfecho {
case .carregar(let endereco):
    print("DESFECHO: carrega \(endereco) (em \(gastou))")
    // As DUAS coisas abaixo são os valores de verdade que a janela usa, não uma
    // cópia deles: se alguém tirar a pasta do título ou da tela de "Abrindo…",
    // isto para de imprimir a pasta e o teste cai.
    print("TITULO DA JANELA: \(TITULOJANELA)")
    print("TELA DE ABRINDO (o HTML que vai para a janela):")
    print(htmlAbrindo())
case .falhar(let texto):
    print("DESFECHO: falha (em \(gastou)). Texto na tela do Marco:")
    print("--------8<--------")
    print(texto)
    print("-------->8--------")
}
// O modo de prova NÃO deixa servidor pendurado, nem quando o caso falha.
if let s = prova.servidor, s.isRunning {
    s.terminate()
    let prazo = Date().addingTimeInterval(5)
    while s.isRunning && Date() < prazo { usleep(100_000) }
    print("(servidor que este teste subiu: encerrado)")
}
exit(0)
#else
let app = NSApplication.shared
let d = Delegate()
app.delegate = d
app.setActivationPolicy(.regular)
app.run()
#endif
