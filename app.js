import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
let bipagensAtuais = []; 
let unsubscribeBipagens = null;

// Telas e Elementos
const telaLogin = document.getElementById('tela-login');
const telaPastas = document.getElementById('tela-pastas');
const telaBipagem = document.getElementById('tela-bipagem');
const modalNovaPasta = document.getElementById('modal-nova-pasta');

// --- SISTEMA DE ALERTA BONITÃO ---
const modalAlerta = document.getElementById('modal-alerta');
const iconeAlerta = document.getElementById('alerta-icone');
const tituloAlerta = document.getElementById('alerta-titulo');
const mensagemAlerta = document.getElementById('alerta-mensagem');

function mostrarAlerta(titulo, mensagem, tipo) {
    tituloAlerta.innerText = titulo;
    mensagemAlerta.innerHTML = mensagem; 
    
    if (tipo === 'erro') {
        iconeAlerta.innerText = '❌';
        tituloAlerta.style.color = '#ef4444'; // Vermelho
        document.getElementById('btn-fechar-alerta').style.backgroundColor = '#ef4444';
    } else {
        iconeAlerta.innerText = '⚠️';
        tituloAlerta.style.color = '#d97706'; // Laranja
        document.getElementById('btn-fechar-alerta').style.backgroundColor = '#d97706';
    }
    modalAlerta.classList.remove('oculto');
}

document.getElementById('btn-fechar-alerta').addEventListener('click', () => {
    modalAlerta.classList.add('oculto');
    document.getElementById('input-codigo').focus();
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
            timestamp: new Date().getTime()
        });
        document.getElementById('form-nova-pasta').reset();
        document.getElementById('container-nfs').innerHTML = '<input type="text" class="input-modal nf-input" placeholder="Nº da Nota Fiscal" required>';
        modalNovaPasta.classList.add('oculto');
    } catch (erro) {
        mostrarAlerta("Erro", "Erro ao criar pasta: " + erro.message, "erro");
    }
});

// --- RENDERIZAR PASTAS ---
onSnapshot(query(collection(db, 'pastas'), orderBy('timestamp', 'desc')), (snapshot) => {
    const lista = document.getElementById('lista-pastas');
    lista.innerHTML = ''; 
    snapshot.forEach((documento) => {
        const pasta = documento.data();
        const id = documento.id;
        const card = document.createElement('div');
        card.className = 'card-item card-pasta';
        const nfsText = pasta.notasFiscais.join(', ');

        card.innerHTML = `
            <div class="info-card" style="flex: 1;">
                <span class="codigo">📁 ${pasta.nome}</span>
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
                abrirPasta(id, pasta.nome, nfsText, pasta.usuario, pasta.volumesTotal);
            }
        });

        lista.appendChild(card);
    });
});

// --- ABRIR UMA PASTA ---
function abrirPasta(id, nome, nfs, usuario, volumesTotal) {
    pastaAtualId = id;
    nomePastaAtual = nome;
    totalVolumesPastaAtual = volumesTotal;

    telaPastas.classList.add('oculto');
    telaBipagem.classList.remove('oculto');
    
    document.getElementById('titulo-pasta-atual').innerText = "📁 " + nome;
    document.getElementById('info-pasta-atual').innerText = `Notas: ${nfs} | Conferente: ${usuario}`;
    document.getElementById('total-volumes').innerText = volumesTotal;
    
    setTimeout(() => document.getElementById('input-codigo').focus(), 100);

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
            document.querySelector('.progresso-container').style.backgroundColor = '#fff3cd';
            document.querySelector('.progresso-container').style.borderColor = '#ffecb5';
        }

        snapshot.forEach((docBip) => {
            const item = docBip.data();
            const idBip = docBip.id;
            bipagensAtuais.push(item.fullCode);

            // === APLICA AS CORES SALVAS NO BANCO ===
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
            // Junta a classe padrão com a classe de cor
            card.className = `card-item card-bipagem ${classeCorCSS}`; 
            
            card.innerHTML = `
                <div class="info-card" style="flex: 1;">
                    <span class="codigo">${iconeStatus} ${item.fullCode}</span>
                    <span class="data">⏰ Lançado às: ${item.hora}</span>
                </div>
                <button class="btn-apagar" onclick="apagarBipagem('${idBip}')">X</button>
            `;
            listaBipagens.appendChild(card);
        });
    });
}

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
    telaBipagem.classList.add('oculto');
    telaPastas.classList.remove('oculto');
});

// --- LÓGICA DE BIPAR E TESTE DE VALIDADE GS1-128 ---
document.getElementById('form-coletor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputCodigo = document.getElementById('input-codigo');
    const codigoLimpo = inputCodigo.value.trim();
    
    if (codigoLimpo === '' || !pastaAtualId) return;

    // 1. BLOQUEIO DE EAN CURTO
    if (codigoLimpo.length <= 14) {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]); 
        mostrarAlerta("Código Incorreto!", "Você bipou o código menor da embalagem (EAN).<br><br><b>Bipe o código maior que contém lote e validade.</b>", "erro");
        inputCodigo.value = ''; 
        return; 
    }

    // Variável para guardar o status que vai pro banco de dados
    let statusDaBipagem = 'ok';

    // 2. LEITURA EXATA DE DATA GS1-128
    if (codigoLimpo.startsWith("01") && codigoLimpo.length >= 24) {
        const identificadorData = codigoLimpo.substring(16, 18);
        
        if (identificadorData === "17") {
            // Separa os números (Ano, Mês e Dia do código)
            const anoVencimento = codigoLimpo.substring(18, 20); 
            const mesVencimento = codigoLimpo.substring(20, 22);
            const diaVencimento = codigoLimpo.substring(22, 24);
            
            // Cria um "Texto" da data do código (Ex: "280722")
            const dataCodigoStr = anoVencimento + mesVencimento + diaVencimento;

            // Pega a data exata de HOJE e cria um texto igual (Ex: "260213" para 13 de Fev de 2026)
            const hoje = new Date();
            const anoAtual = hoje.getFullYear().toString().substring(2, 4);
            const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
            const diaAtual = String(hoje.getDate()).padStart(2, '0');
            const dataHojeStr = anoAtual + mesAtual + diaAtual;

            // === A GRANDE MÁGICA DA COMPARAÇÃO ===
            
            // 1º TESTE: Já passou da data? (Vencido)
            if (dataCodigoStr < dataHojeStr) {
                if (navigator.vibrate) navigator.vibrate([800, 300, 800, 300, 800]); 
                mostrarAlerta(
                    "🚨 PRODUTO VENCIDO! 🚨",
                    `A validade desta caixa expirou no dia <b>${diaVencimento}/${mesVencimento}/20${anoVencimento}</b>!<br><br><b>O código ficará marcado em VERMELHO. Separe este produto imediatamente!</b>`,
                    "erro"
                );
                statusDaBipagem = 'vencido';
            } 
            // 2º TESTE: Vence este ano? (Atenção)
            else if (anoVencimento === anoAtual) {
                if (navigator.vibrate) navigator.vibrate([500, 200, 500]); 
                mostrarAlerta(
                    "⚠️ Cuidado com a Validade!",
                    `Este produto VENCE NESTE ANO (<b>${diaVencimento}/${mesVencimento}/20${anoVencimento}</b>)!<br><br>O código ficará marcado em <b>Laranja</b> para conferência.`,
                    "aviso"
                );
                statusDaBipagem = 'vence_este_ano';
            }
        }
    }

    // 3. SALVAR NO BANCO DE DADOS (Junto com o status da cor!)
    try {
        await addDoc(collection(db, 'pastas', pastaAtualId, 'bipagens'), {
            fullCode: codigoLimpo,
            hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            timestamp: new Date().getTime(),
            statusValidade: statusDaBipagem // <--- Isso grava a cor para sempre!
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

setInterval(() => {
    if (!telaBipagem.classList.contains('oculto') && 
        modalNovaPasta.classList.contains('oculto') &&
        modalAlerta.classList.contains('oculto')) {
        
        const inputCodigo = document.getElementById('input-codigo');
        if(document.activeElement !== inputCodigo) inputCodigo.focus();
    }
}, 3000);
