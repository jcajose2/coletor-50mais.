import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- SUA CONFIGURAÇÃO ---
const firebaseConfig = {
    apiKey: "AIzaSyC-SDsCnnIHzgDehBZ-8hjNkwLdPF3Hxyg", 
    authDomain: "coletor-50mais.firebaseapp.com",
    projectId: "coletor-50mais",
    storageBucket: "coletor-50mais.firebasestorage.app",
    messagingSenderId: "143912837239",
    appId: "1:143912837239:web:bfb051032f8df3922ae672"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Variáveis Globais de Estado
let pastaAtualId = null; 
let nomePastaAtual = ""; 
let totalVolumesPastaAtual = 0;
let statusPastaAtual = "aberta"; // NOVO: Guarda o status da pasta aberta
let bipagensAtuais = []; 
let unsubscribeBipagens = null;

// Telas e Elementos
const telaLogin = document.getElementById('tela-login');
const telaPastas = document.getElementById('tela-pastas');
const telaBipagem = document.getElementById('tela-bipagem');
const modalNovaPasta = document.getElementById('modal-nova-pasta');
const modalAlerta = document.getElementById('modal-alerta');
const iconeAlerta = document.getElementById('alerta-icone');
const tituloAlerta = document.getElementById('alerta-titulo');
const mensagemAlerta = document.getElementById('alerta-mensagem');

// --- SISTEMA DE ALERTA BONITÃO ---
function mostrarAlerta(titulo, mensagem, tipo) {
    tituloAlerta.innerText = titulo;
    mensagemAlerta.innerHTML = mensagem; 
    
    if (tipo === 'erro') {
        iconeAlerta.innerText = '❌';
        tituloAlerta.style.color = '#e53e3e'; 
        document.getElementById('btn-fechar-alerta').style.backgroundColor = '#e53e3e';
    } else {
        iconeAlerta.innerText = '⚠️';
        tituloAlerta.style.color = '#d97706'; 
        document.getElementById('btn-fechar-alerta').style.backgroundColor = '#d97706';
    }
    modalAlerta.classList.remove('oculto');
}

document.getElementById('btn-fechar-alerta').addEventListener('click', () => {
    modalAlerta.classList.add('oculto');
    // Só foca no input se a pasta estiver aberta
    if(statusPastaAtual === "aberta") {
        document.getElementById('input-codigo').focus();
    }
});


// --- AUTENTICAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        telaLogin.classList.add('oculto');
        telaPastas.classList.remove('oculto');
    } else {
        telaPastas.classList.add('oculto');
        telaBipagem.classList.add('oculto');
        telaLogin.classList.remove('oculto');
    }
});

document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('senha').value);
        document.getElementById('erro-login').style.display = 'none';
    } catch (error) {
        document.getElementById('erro-login').style.display = 'block';
    }
});

document.getElementById('btn-sair').addEventListener('click', () => signOut(auth));

// --- LÓGICA DO MODAL (NOVA PASTA) ---
document.getElementById('btn-abrir-modal').addEventListener('click', () => modalNovaPasta.classList.remove('oculto'));
document.getElementById('btn-fechar-modal').addEventListener('click', () => modalNovaPasta.classList.add('oculto'));

document.getElementById('btn-add-nf').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input-modal nf-input';
    input.placeholder = 'Nº da Nota Fiscal (Extra)';
    input.required = true;
    document.getElementById('container-nfs').appendChild(input);
});

document.getElementById('form-nova-pasta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputsNF = document.querySelectorAll('.nf-input');
    const notasFiscais = Array.from(inputsNF).map(input => input.value.trim()).filter(val => val !== '');
    const nome = document.getElementById('pasta-nome').value;
    const usuario = document.getElementById('pasta-usuario').value;
    const volumes = document.getElementById('pasta-volumes').value;
    
    try {
        await addDoc(collection(db, 'pastas'), {
            nome: nome,
            usuario: usuario,
            volumesTotal: parseInt(volumes),
            notasFiscais: notasFiscais,
            dataCriacao: new Date().toLocaleDateString('pt-BR'),
            timestamp: new Date().getTime(),
            status: 'aberta' // NOVO: Toda pasta nasce aberta
        });
        document.getElementById('form-nova-pasta').reset();
        document.getElementById('container-nfs').innerHTML = '<input type="text" class="input-modal nf-input" placeholder="Nº da Nota Fiscal" required>';
        modalNovaPasta.classList.add('oculto');
    } catch (erro) {
        mostrarAlerta("Erro", "Erro ao criar pasta: " + erro.message, "erro");
    }
});

// --- RENDERIZAR PASTAS (SEPARANDO ABERTAS DE FINALIZADAS) ---
onSnapshot(query(collection(db, 'pastas'), orderBy('timestamp', 'desc')), (snapshot) => {
    const listaAbertas = document.getElementById('lista-pastas');
    const listaFinalizadas = document.getElementById('lista-pastas-finalizadas');
    
    listaAbertas.innerHTML = ''; 
    listaFinalizadas.innerHTML = ''; 

    snapshot.forEach((documento) => {
        const pasta = documento.data();
        const id = documento.id;
        // Tratamento para pastas antigas que não tinham status
        const statusReal = pasta.status ? pasta.status : 'aberta'; 
        
        const card = document.createElement('div');
        // Muda a cor do cartão dependendo do status
        card.className = `card-item ${statusReal === 'finalizada' ? 'card-finalizada' : 'card-pasta'}`;
        
        const nfsText = pasta.notasFiscais.join(', ');
        const iconeStatus = statusReal === 'finalizada' ? '🔒' : '📁';

        card.innerHTML = `
            <div class="info-card" style="flex: 1;">
                <span class="codigo">${iconeStatus} ${pasta.nome}</span>
                <span class="data">NF(s): ${nfsText}</span>
                <span class="data">Conferente: <span class="destaque">${pasta.usuario}</span></span>
                <span class="data">Data: ${pasta.dataCriacao} | Volumes: ${pasta.volumesTotal}</span>
            </div>
            <button class="btn-apagar btn-apagar-pasta" title="Excluir Pasta">🗑️</button>
        `;
        
        card.addEventListener('click', async (e) => {
            if (e.target.closest('.btn-apagar-pasta')) {
                if(confirm(`⚠️ ATENÇÃO: Tem certeza que deseja excluir a pasta "${pasta.nome}" inteira?\nIsso não pode ser desfeito.`)) {
                    await deleteDoc(doc(db, 'pastas', id));
                }
            } else {
                abrirPasta(id, pasta.nome, nfsText, pasta.usuario, pasta.volumesTotal, statusReal);
            }
        });

        // Joga para a lista certa na tela
        if (statusReal === 'finalizada') {
            listaFinalizadas.appendChild(card);
        } else {
            listaAbertas.appendChild(card);
        }
    });
});

// --- ABRIR UMA PASTA ---
function abrirPasta(id, nome, nfs, usuario, volumesTotal, status) {
    pastaAtualId = id;
    nomePastaAtual = nome;
    totalVolumesPastaAtual = volumesTotal;
    statusPastaAtual = status;

    telaPastas.classList.add('oculto');
    telaBipagem.classList.remove('oculto');
    
    const iconeCabecalho = status === 'finalizada' ? '🔒' : '📁';
    document.getElementById('titulo-pasta-atual').innerText = `${iconeCabecalho} ${nome}`;
    document.getElementById('info-pasta-atual').innerText = `Notas: ${nfs} | Conferente: ${usuario}`;
    document.getElementById('total-volumes').innerText = volumesTotal;
    
    // NOVO: Controle de Bloqueio da Interface
    const inputCodigo = document.getElementById('input-codigo');
    const btnFinalizar = document.getElementById('btn-finalizar');
    const statusTexto = document.querySelector('.status');

    if (status === 'finalizada') {
        inputCodigo.disabled = true;
        inputCodigo.placeholder = "PASTA FINALIZADA. LEITURA BLOQUEADA.";
        btnFinalizar.style.display = 'none'; // Esconde o botão de finalizar
        statusTexto.innerText = "🔒 Esta carga já foi conferida e fechada.";
        statusTexto.style.color = "#e53e3e";
    } else {
        inputCodigo.disabled = false;
        inputCodigo.placeholder = "Passe o leitor de código de barras aqui...";
        btnFinalizar.style.display = 'inline-block'; // Mostra o botão
        statusTexto.innerText = "🟢 Sistema ativo e gravando em tempo real";
        statusTexto.style.color = "#718096";
        setTimeout(() => inputCodigo.focus(), 100);
    }

    if (unsubscribeBipagens) unsubscribeBipagens();

    const qBipagens = query(collection(db, 'pastas', id, 'bipagens'), orderBy('timestamp', 'asc'));
    
    unsubscribeBipagens = onSnapshot(qBipagens, (snapshot) => {
        const listaBipagens = document.getElementById('lista-itens');
        listaBipagens.innerHTML = '';
        bipagensAtuais = []; 

        document.getElementById('contador-volumes').innerText = snapshot.size;

        if(snapshot.size >= totalVolumesPastaAtual) {
            document.querySelector('.progresso-container').style.backgroundColor = '#d1e7dd';
            document.querySelector('.progresso-container').style.borderColor = '#badbcc';
        } else {
            document.querySelector('.progresso-container').style.backgroundColor = '#f0fdf4';
            document.querySelector('.progresso-container').style.borderColor = '#bbf7d0';
        }

        snapshot.forEach((docBip) => {
            const item = docBip.data();
            const idBip = docBip.id;
            bipagensAtuais.push(item.fullCode);

            let classeCorCSS = '';
            let iconeStatus = '✅';

            if (item.statusValidade === 'vencido') {
                classeCorCSS = 'card-vencido';
                iconeStatus = '🚨';
            } else if (item.statusValidade === 'vence_este_ano') {
                classeCorCSS = 'card-vence-ano';
                iconeStatus = '⚠️';
            }

            const card = document.createElement('div');
            card.className = `card-item card-bipagem ${classeCorCSS}`; 
            
            // Se estiver finalizada, removemos o botão de apagar o item individual também!
            const botaoApagar = status === 'finalizada' ? '' : `<button class="btn-apagar" onclick="apagarBipagem('${idBip}')">X</button>`;

            card.innerHTML = `
                <div class="info-card" style="flex: 1;">
                    <span class="codigo">${iconeStatus} ${item.fullCode}</span>
                    <span class="data">⏰ Lançado às: ${item.hora}</span>
                </div>
                ${botaoApagar}
            `;
            listaBipagens.appendChild(card);
        });
    });
}

// --- NOVO: FUNÇÃO DE FINALIZAR PASTA ---
document.getElementById('btn-finalizar').addEventListener('click', async () => {
    if(confirm(`🔒 ATENÇÃO!\nTem certeza que deseja FINALIZAR a carga "${nomePastaAtual}"?\n\nApós finalizada, o leitor será bloqueado e não será possível adicionar nem remover itens desta pasta.`)) {
        try {
            await updateDoc(doc(db, 'pastas', pastaAtualId), {
                status: 'finalizada'
            });
            // Quando terminar de atualizar, volta sozinho pra tela inicial
            document.getElementById('btn-voltar').click();
        } catch (erro) {
            mostrarAlerta("Erro", "Não foi possível finalizar a pasta. Verifique a internet.", "erro");
        }
    }
});

// --- FUNÇÃO DE EXPORTAR (.TXT) ---
document.getElementById('btn-exportar').addEventListener('click', () => {
    if (bipagensAtuais.length === 0) {
        mostrarAlerta("Erro ao Exportar", "A pasta está vazia! Não há códigos para baixar.", "erro");
        return;
    }
    const conteudoTXT = bipagensAtuais.join('\n');
    const blob = new Blob([conteudoTXT], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Bipagens_${nomePastaAtual.replace(/\s+/g, '_')}.txt`; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- VOLTAR PARA DASHBOARD ---
document.getElementById('btn-voltar').addEventListener('click', () => {
    pastaAtualId = null;
    statusPastaAtual = "aberta";
    telaBipagem.classList.add('oculto');
    telaPastas.classList.remove('oculto');
});

// --- LÓGICA DE BIPAR (COM BLOQUEIOS MULTIPLOS) ---
document.getElementById('form-coletor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputCodigo = document.getElementById('input-codigo');
    const codigoLimpo = inputCodigo.value.trim();
    
    // Impede de bipar se a pasta estiver finalizada ou vazia
    if (codigoLimpo === '' || !pastaAtualId || statusPastaAtual === 'finalizada') return;

    // 0. BLOQUEIO DE QR CODE DE SITE
    const textoMinusculo = codigoLimpo.toLowerCase();
    if (textoMinusculo.includes('http://') || textoMinusculo.includes('https://') || textoMinusculo.includes('www.')) {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]); 
        mostrarAlerta("QR Code Inválido!", "Você bipou um <b>QR Code de site</b> em vez do código de barras.<br><br>Procure o código longo (GS1).", "erro");
        inputCodigo.value = ''; 
        return; 
    }

    // 1. BLOQUEIO DE CÓDIGO ERRADO (EAN)
    if (codigoLimpo.length <= 14) {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]); 
        mostrarAlerta("Código Incorreto!", "Você bipou o código menor da embalagem (EAN).<br><br>Bipe o código maior que contém lote e validade.", "erro");
        inputCodigo.value = ''; 
        return; 
    }

    let statusDaBipagem = 'ok';

    // 2. LEITURA DE DATA GS1-128
    if (codigoLimpo.startsWith("01") && codigoLimpo.length >= 24) {
        const identificadorData = codigoLimpo.substring(16, 18);
        
        if (identificadorData === "17") {
            const anoVencimento = codigoLimpo.substring(18, 20); 
            const mesVencimento = codigoLimpo.substring(20, 22);
            const diaVencimento = codigoLimpo.substring(22, 24);
            
            const dataCodigoStr = anoVencimento + mesVencimento + diaVencimento;

            const hoje = new Date();
            const anoAtual = hoje.getFullYear().toString().substring(2, 4);
            const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
            const diaAtual = String(hoje.getDate()).padStart(2, '0');
            const dataHojeStr = anoAtual + mesAtual + diaAtual;
            
            if (dataCodigoStr < dataHojeStr) {
                if (navigator.vibrate) navigator.vibrate([800, 300, 800, 300, 800]); 
                mostrarAlerta("🚨 PRODUTO VENCIDO! 🚨", `A validade desta caixa expirou no dia <b>${diaVencimento}/${mesVencimento}/20${anoVencimento}</b>!<br><br><b>Separe este produto imediatamente!</b>`, "erro");
                statusDaBipagem = 'vencido';
            } 
            else if (anoVencimento === anoAtual) {
                if (navigator.vibrate) navigator.vibrate([500, 200, 500]); 
                mostrarAlerta("⚠️ Cuidado com a Validade!", `Este produto VENCE NESTE ANO (<b>${diaVencimento}/${mesVencimento}/20${anoVencimento}</b>)!<br><br>O código ficará marcado em Laranja.`, "aviso");
                statusDaBipagem = 'vence_este_ano';
            }
        }
    }

    // 3. SALVAR NO BANCO
    try {
        await addDoc(collection(db, 'pastas', pastaAtualId, 'bipagens'), {
            fullCode: codigoLimpo,
            hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            timestamp: new Date().getTime(),
            statusValidade: statusDaBipagem
        });
        inputCodigo.value = '';
        inputCodigo.focus(); 
    } catch (erro) {
        mostrarAlerta("Falha de Conexão", "Erro ao salvar! Verifique sua internet.", "erro");
    }
});

// --- APAGAR UMA BIPAGEM ---
window.apagarBipagem = async (idBipagem) => {
    if(confirm("Deseja mesmo excluir este item?")) {
        await deleteDoc(doc(db, 'pastas', pastaAtualId, 'bipagens', idBipagem));
    }
};

// Manter foco no leitor
setInterval(() => {
    if (!telaBipagem.classList.contains('oculto') && 
        modalNovaPasta.classList.contains('oculto') &&
        modalAlerta.classList.contains('oculto') && 
        statusPastaAtual === "aberta") { // Só rouba o foco se a pasta estiver aberta!
        
        const inputCodigo = document.getElementById('input-codigo');
        if(document.activeElement !== inputCodigo) inputCodigo.focus();
    }
}, 3000);