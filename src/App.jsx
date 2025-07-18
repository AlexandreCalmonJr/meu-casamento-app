import { AlertCircle, Calendar, Camera, CheckCircle, DollarSign, Flower, Gem, Heart, Lightbulb, ListChecks, LogOut, MapPin, Music, Paperclip, PieChart, PiggyBank, PlusCircle, ShieldX, Shirt, Target, Trash2, TrendingDown, TrendingUp, UploadCloud, Utensils } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getFirestore, onSnapshot, query, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

// =================================================================
//  INSTRUÇÃO: Cole a configuração do seu projeto Firebase aqui.
// =================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDw5pBRNtVT5rOPYScyuPnZffTES2h3hqU",
    authDomain: "financas-eb654.firebaseapp.com",
    projectId: "financas-eb654",
    storageBucket: "financas-eb654.firebasestorage.app",
    messagingSenderId: "923684279107",
    appId: "1:923684279107:web:ecfa62bd5396d73fdc95f6",
    measurementId: "G-YJYZBQTB0M"
  };

// --- E-mails autorizados ---
const EMAILS_AUTORIZADOS = [
    'alexandrecalmonjunior@gmail.com',
    'andressarsl24@gmail.com'
];

// --- Constantes e Funções Utilitárias ---
const CATEGORIAS = [
    { name: 'Local', icon: MapPin, color: 'bg-purple-500', avgPercent: 45 },
    { name: 'Buffet', icon: Utensils, color: 'bg-green-500', avgPercent: 25 },
    { name: 'Fotografia', icon: Camera, color: 'bg-blue-500', avgPercent: 10 },
    { name: 'Música', icon: Music, color: 'bg-pink-500', avgPercent: 5 },
    { name: 'Flores', icon: Flower, color: 'bg-yellow-500', avgPercent: 5 },
    { name: 'Trajes', icon: Shirt, color: 'bg-indigo-500', avgPercent: 5 },
    { name: 'Alianças', icon: Gem, color: 'bg-red-500', avgPercent: 2 },
    { name: 'Outros', icon: Heart, color: 'bg-teal-500', avgPercent: 3 }
];

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
const formatarData = (stringData) => {
    if (!stringData) return '';
    const data = new Date(stringData + 'T00:00:00');
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(data);
};

// --- Componente de Login ---
const LoginPage = ({ onLogin }) => (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-rose-50 to-pink-50">
        <div className="text-center bg-white p-10 rounded-2xl shadow-xl">
            <Heart className="w-16 h-16 text-rose-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Finanças do Casamento</h1>
            <p className="text-gray-600 mb-8">Faça o login para planejar o grande dia.</p>
            <button
                onClick={onLogin}
                className="w-full bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg flex items-center justify-center space-x-3 hover:bg-gray-50 transition-all"
            >
                <img src="https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png" alt="Google logo" className="w-6 h-6" />
                <span>Entrar com o Google</span>
            </button>
        </div>
    </div>
);

// --- Componente de Acesso Negado ---
const AccessDeniedPage = ({ user, onLogout }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-yellow-50 text-center p-4">
        <ShieldX className="w-20 h-20 text-red-500 mb-6" />
        <h1 className="text-4xl font-bold text-gray-800 mb-3">Acesso Negado</h1>
        <p className="text-lg text-gray-600 mb-4">Olá, {user.displayName}.</p>
        <p className="text-md text-gray-500 max-w-md mb-8">
            Seu e-mail (<span className="font-semibold">{user.email}</span>) não tem permissão para acessar este painel. Por favor, contate o administrador se você acredita que isso é um erro.
        </p>
        <button
            onClick={onLogout}
            className="bg-red-500 text-white font-semibold py-3 px-8 rounded-lg flex items-center justify-center space-x-2 hover:bg-red-600 transition-all"
        >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
        </button>
    </div>
);

// --- Componente Principal da Aplicação (O Painel) ---
const WeddingPlanner = ({ user, onLogout, db, storage }) => {
    const userId = user.uid;
    const [abaAtiva, setAbaAtiva] = useState('dashboard');
    const [dataCasamento, setDataCasamento] = useState('');
    const [metaOrcamento, setMetaOrcamento] = useState(0);
    const [rendas, setRendas] = useState([]);
    const [despesas, setDespesas] = useState([]);
    const [novaRenda, setNovaRenda] = useState({ descricao: '', valor: '', data: '' });
    const [novaDespesa, setNovaDespesa] = useState({ categoria: '', descricao: '', valor: '', data: '', parcelas: '1' });
    const [uploading, setUploading] = useState(null); // ID da despesa em upload

    // --- Busca e Sincronização de Dados ---
    useEffect(() => {
        if (!db || !userId) return;
        const userDocPath = `/users/${userId}`;
        const rendasRef = collection(db, `${userDocPath}/rendas`);
        const despesasRef = collection(db, `${userDocPath}/despesas`);
        const settingsRef = doc(db, `${userDocPath}/settings/main`);

        const unsubRendas = onSnapshot(query(rendasRef), snap => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(a.data) - new Date(b.data));
            setRendas(data);
        });
        const unsubDespesas = onSnapshot(query(despesasRef), snap => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(a.data) - new Date(b.data));
            setDespesas(data);
        });
        const unsubSettings = onSnapshot(settingsRef, doc => {
            if (doc.exists()) {
                const data = doc.data();
                setDataCasamento(data.dataCasamento || '2026-10-17');
                setMetaOrcamento(data.metaOrcamento || 60000);
            } else {
                setDataCasamento('2026-10-17');
                setMetaOrcamento(60000);
            }
        });

        return () => { unsubRendas(); unsubDespesas(); unsubSettings(); };
    }, [db, userId]);

    // --- Funções de Manipulação de Dados ---
    const getCollectionRef = (name) => collection(db, `/users/${userId}/${name}`);
    const getDocRef = (name, id) => doc(db, `/users/${userId}/${name}/${id}`);

    const adicionarRenda = useCallback(async () => {
        if (novaRenda.descricao && novaRenda.valor && novaRenda.data) {
            await addDoc(getCollectionRef('rendas'), { ...novaRenda, valor: parseFloat(novaRenda.valor) });
            setNovaRenda({ descricao: '', valor: '', data: '' });
        }
    }, [novaRenda, db, userId]);

    const deletarRenda = useCallback(async (id) => await deleteDoc(getDocRef('rendas', id)), [db, userId]);

    const adicionarDespesa = useCallback(async () => {
        const { categoria, descricao, valor, data, parcelas } = novaDespesa;
        if (categoria && descricao && valor && data) {
            const numValor = parseFloat(valor);
            const numParcelas = parseInt(parcelas, 10) || 1;
            const idRaiz = Date.now();
            if (numParcelas > 1) {
                const valorParcela = numValor / numParcelas;
                for (let i = 0; i < numParcelas; i++) {
                    const dataParcela = new Date(data + 'T00:00:00');
                    dataParcela.setMonth(dataParcela.getMonth() + i);
                    await addDoc(getCollectionRef('despesas'), { idRaiz, categoria, descricao: `${descricao} (${i + 1}/${numParcelas})`, valor: valorParcela, data: dataParcela.toISOString().split('T')[0], pago: false });
                }
            } else {
                await addDoc(getCollectionRef('despesas'), { idRaiz, categoria, descricao, valor: numValor, data, pago: false });
            }
            setNovaDespesa({ categoria: '', descricao: '', valor: '', data: '', parcelas: '1' });
        }
    }, [novaDespesa, db, userId]);

    const alternarPagamento = useCallback(async (id, status) => await updateDoc(getDocRef('despesas', id), { pago: !status }), [db, userId]);
    const deletarDespesa = useCallback(async (id) => await deleteDoc(getDocRef('despesas', id)), [db, userId]);
    const atualizarConfig = useCallback(async (config) => await setDoc(doc(db, `/users/${userId}/settings/main`), config, { merge: true }), [db, userId]);

    const uploadComprovante = async (e, despesaId) => {
        const file = e.target.files[0];
        if (!file || !storage || !userId) return;
        setUploading(despesaId);
        const storageRef = ref(storage, `comprovantes/${userId}/${despesaId}/${file.name}`);
        try {
            const uploadTask = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(uploadTask.ref);
            await updateDoc(getDocRef('despesas', despesaId), { comprovanteURL: downloadURL });
        } catch (error) {
            console.error("Erro no upload:", error);
            alert("Falha no upload do comprovante.");
        } finally {
            setUploading(null);
        }
    };

    // --- Cálculos e Lógica de Planejamento (Memoizados) ---
    const totalRenda = useMemo(() => rendas.reduce((s, r) => s + r.valor, 0), [rendas]);
    const totalDespesas = useMemo(() => despesas.reduce((s, d) => s + d.valor, 0), [despesas]);
    const totalPago = useMemo(() => despesas.filter(d => d.pago).reduce((s, d) => s + d.valor, 0), [despesas]);
    const saldoAtual = useMemo(() => totalRenda - totalPago, [totalRenda, totalPago]);
    const aPagar = useMemo(() => totalDespesas - totalPago, [totalDespesas, totalPago]);
    const usoOrcamento = useMemo(() => (metaOrcamento > 0 ? (totalDespesas / metaOrcamento) * 100 : 0), [metaOrcamento, totalDespesas]);

    const planejamento = useMemo(() => {
        if (!dataCasamento) return { diasAteCasamento: 0, alertas: [], sugestoes: [], analiseGastos: [] };
        const hoje = new Date();
        const dataFinal = new Date(dataCasamento + 'T00:00:00');
        const diffTime = dataFinal - hoje;
        const diasAteCasamento = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        const mesesAteCasamento = Math.max(1, diasAteCasamento / 30.44);

        const alertas = [];
        const sugestoes = [];
        const analiseGastos = [];

        const metaEconomiaMensal = aPagar > 0 ? aPagar / mesesAteCasamento : 0;
        if (metaEconomiaMensal > 0) {
            alertas.push({ tipo: 'info', icone: PiggyBank, texto: `Para quitar tudo a tempo, vocês precisam economizar em média ${formatarMoeda(metaEconomiaMensal)} por mês.` });
        }

        const pagamentos30dias = despesas.filter(d => {
            const dataVencimento = new Date(d.data + 'T00:00:00');
            const diffDias = (dataVencimento - hoje) / (1000 * 60 * 60 * 24);
            return !d.pago && diffDias > 0 && diffDias <= 30;
        }).reduce((soma, d) => soma + d.valor, 0);

        if (pagamentos30dias > saldoAtual) {
            alertas.push({ tipo: 'error', icone: AlertCircle, texto: `Atenção: seu saldo atual (${formatarMoeda(saldoAtual)}) não cobre os pagamentos dos próximos 30 dias (${formatarMoeda(pagamentos30dias)}).` });
        }

        if (totalDespesas > metaOrcamento) {
            alertas.push({ tipo: 'warning', icone: Target, texto: `Sua meta de orçamento foi ultrapassada em ${formatarMoeda(totalDespesas - metaOrcamento)}.` });
        }

        if (diasAteCasamento > 365) sugestoes.push({ icone: ListChecks, texto: "Falta mais de 1 ano: Ótimo momento para definir o estilo do casamento, a lista de convidados e contratar fornecedores principais como Local e Buffet." });
        else if (diasAteCasamento > 180) sugestoes.push({ icone: ListChecks, texto: "Entre 6-12 meses: Contratem fotógrafo, filmagem e música. Pesquisem os trajes e a decoração." });
        else if (diasAteCasamento > 90) sugestoes.push({ icone: ListChecks, texto: "Entre 3-6 meses: Enviem os convites, definam o cardápio e comprem as alianças." });
        else if (diasAteCasamento > 30) sugestoes.push({ icone: ListChecks, texto: "Últimos 3 meses: Façam a degustação final, confirmem presença dos convidados e alinhem os detalhes finais com todos os fornecedores." });
        else sugestoes.push({ icone: ListChecks, texto: "Reta final! Confirmem todos os pagamentos e horários. No mais, relaxem e preparem-se para o grande dia!" });
        sugestoes.push({ icone: Lightbulb, texto: "Reservem de 5% a 10% do orçamento total para despesas inesperadas. É uma margem de segurança importante." });

        CATEGORIAS.forEach(cat => {
            const gastoCategoria = despesas.filter(d => d.categoria === cat.name).reduce((soma, d) => soma + d.valor, 0);
            if (gastoCategoria > 0) {
                const percentualReal = (gastoCategoria / totalDespesas) * 100;
                const percentualMedio = cat.avgPercent;
                let tipo = 'ok';
                if (percentualReal > percentualMedio * 1.2) tipo = 'alto';
                if (percentualReal < percentualMedio * 0.8) tipo = 'baixo';
                analiseGastos.push({ categoria: cat.name, percentualReal: percentualReal.toFixed(1), percentualMedio: percentualMedio, tipo: tipo });
            }
        });
        return { diasAteCasamento, alertas, sugestoes, analiseGastos };
    }, [dataCasamento, despesas, rendas, metaOrcamento, aPagar, saldoAtual, totalDespesas]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50 font-sans">
            <div className="max-w-7xl mx-auto p-4 sm:p-6">
                {/* Cabeçalho */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="flex items-center space-x-4">
                            <img src={user.photoURL} alt={user.displayName} className="w-12 h-12 rounded-full" />
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Finanças do Casamento</h1>
                                <p className="text-gray-600">Bem-vindo(a), {user.displayName}!</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-center sm:text-right">
                                <div className="text-sm text-gray-500 flex items-center justify-center sm:justify-end gap-2"><Target className="w-4 h-4" /> Meta</div>
                                <input type="number" value={metaOrcamento} onChange={e => atualizarConfig({ metaOrcamento: parseFloat(e.target.value) || 0 })} className="text-xl font-bold text-gray-800 bg-transparent text-center sm:text-right w-40 rounded-lg p-1 hover:bg-gray-100 focus:bg-gray-100 focus:ring-2 focus:ring-rose-300 outline-none" />
                            </div>
                            <div className="text-center sm:text-right">
                                <div className="text-sm text-gray-500 flex items-center justify-center sm:justify-end gap-2"><Calendar className="w-4 h-4" /> Data</div>
                                <input type="date" value={dataCasamento} onChange={e => atualizarConfig({ dataCasamento: e.target.value })} className="text-xl font-bold text-gray-800 bg-transparent text-center sm:text-right w-40 rounded-lg p-1 hover:bg-gray-100 focus:bg-gray-100 focus:ring-2 focus:ring-rose-300 outline-none" />
                            </div>
                            <button onClick={onLogout} className="bg-gray-200 p-3 rounded-full text-gray-600 hover:bg-red-100 hover:text-red-600 transition-colors"><LogOut className="w-5 h-5" /></button>
                        </div>
                    </div>
                </div>

                {/* Navegação */}
                <div className="bg-white rounded-2xl shadow-xl mb-6">
                    <div className="flex space-x-1 p-2">
                        {['dashboard', 'despesas', 'renda', 'planejamento'].map((aba) => (
                            <button key={aba} onClick={() => setAbaAtiva(aba)} className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all text-sm sm:text-base ${abaAtiva === aba ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-50'}`}>
                                {aba.charAt(0).toUpperCase() + aba.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Conteúdo das Abas */}
                {abaAtiva === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white rounded-2xl shadow-xl p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Total Arrecadado</p><p className="text-2xl font-bold text-green-600">{formatarMoeda(totalRenda)}</p></div><div className="bg-green-100 p-3 rounded-full"><TrendingUp className="w-6 h-6 text-green-600" /></div></div></div>
                            <div className="bg-white rounded-2xl shadow-xl p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Total Despesas</p><p className="text-2xl font-bold text-red-600">{formatarMoeda(totalDespesas)}</p></div><div className="bg-red-100 p-3 rounded-full"><TrendingDown className="w-6 h-6 text-red-600" /></div></div></div>
                            <div className="bg-white rounded-2xl shadow-xl p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Saldo Atual</p><p className="text-2xl font-bold text-blue-600">{formatarMoeda(saldoAtual)}</p></div><div className="bg-blue-100 p-3 rounded-full"><PiggyBank className="w-6 h-6 text-blue-600" /></div></div></div>
                            <div className="bg-white rounded-2xl shadow-xl p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">A Pagar</p><p className="text-2xl font-bold text-yellow-600">{formatarMoeda(aPagar)}</p></div><div className="bg-yellow-100 p-3 rounded-full"><Calendar className="w-6 h-6 text-yellow-600" /></div></div></div>
                        </div>
                        <div className="bg-white rounded-2xl shadow-xl p-6">
                            <h3 className="text-lg font-semibold mb-4">Progresso da Meta</h3>
                            <div className="w-full bg-gray-200 rounded-full h-4"><div className={`h-4 rounded-full transition-all duration-500 ${usoOrcamento > 90 ? 'bg-red-500' : usoOrcamento > 70 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(usoOrcamento, 100)}%` }}></div></div>
                            <p className="text-sm text-gray-600 mt-2">{formatarMoeda(totalDespesas)} de {formatarMoeda(metaOrcamento)} comprometidos ({usoOrcamento.toFixed(1)}%)</p>
                        </div>
                    </div>
                )}
                
                {abaAtiva === 'despesas' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl shadow-xl p-6">
                            <h3 className="text-lg font-semibold mb-4">Adicionar Nova Despesa</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <input type="text" placeholder="Descrição" value={novaDespesa.descricao} onChange={(e) => setNovaDespesa({...novaDespesa, descricao: e.target.value})} className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500" />
                                <select value={novaDespesa.categoria} onChange={(e) => setNovaDespesa({...novaDespesa, categoria: e.target.value})} className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"><option value="">Categoria</option>{CATEGORIAS.map(cat => (<option key={cat.name} value={cat.name}>{cat.name}</option>))}</select>
                                <input type="number" placeholder="Valor Total" value={novaDespesa.valor} onChange={(e) => setNovaDespesa({...novaDespesa, valor: e.target.value})} className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500" />
                                <input type="date" title="Data do primeiro pagamento" value={novaDespesa.data} onChange={(e) => setNovaDespesa({...novaDespesa, data: e.target.value})} className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500" />
                                <input type="number" placeholder="Nº de Parcelas" value={novaDespesa.parcelas} onChange={(e) => setNovaDespesa({...novaDespesa, parcelas: e.target.value})} className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500" min="1" />
                                <button onClick={adicionarDespesa} className="bg-gradient-to-r from-rose-500 to-pink-500 text-white px-6 py-3 rounded-xl font-medium hover:from-rose-600 hover:to-pink-600 transition-all flex items-center justify-center space-x-2"><PlusCircle className="w-5 h-5" /><span>Adicionar</span></button>
                            </div>
                        </div>
                        
                        <div className="bg-white rounded-2xl shadow-xl p-6">
                            <h3 className="text-lg font-semibold mb-4">Lista de Despesas</h3>
                            <div className="space-y-3">
                                {despesas.map((despesa) => {
                                    const infoCategoria = CATEGORIAS.find(c => c.name === despesa.categoria);
                                    const Icone = infoCategoria?.icon || Heart;
                                    return (
                                        <div key={despesa.id} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-gray-50 rounded-xl gap-3">
                                            <div className="flex items-center space-x-4 w-full sm:w-2/3">
                                                <div className={`${infoCategoria?.color || 'bg-gray-500'} p-2 rounded-lg`}><Icone className="w-5 h-5 text-white" /></div>
                                                <div>
                                                    <p className="font-medium text-gray-800">{despesa.descricao}</p>
                                                    <p className="text-sm text-gray-600">{despesa.categoria} • Venc: {formatarData(despesa.data)}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2 w-full sm:w-auto justify-between">
                                                <div className="text-right">
                                                    <p className="font-bold text-gray-800">{formatarMoeda(despesa.valor)}</p>
                                                    <p className={`text-sm font-semibold ${despesa.pago ? 'text-green-600' : 'text-red-600'}`}>{despesa.pago ? 'Pago' : 'Pendente'}</p>
                                                </div>
                                                {despesa.comprovanteURL ? (
                                                    <a href={despesa.comprovanteURL} target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"><Paperclip className="w-5 h-5" /></a>
                                                ) : (
                                                    <label className={`p-2 rounded-lg cursor-pointer ${uploading === despesa.id ? 'bg-gray-300 animate-pulse' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                                                        <UploadCloud className="w-5 h-5" />
                                                        <input type="file" className="hidden" onChange={(e) => uploadComprovante(e, despesa.id)} disabled={uploading === despesa.id} />
                                                    </label>
                                                )}
                                                <button onClick={() => alternarPagamento(despesa.id, despesa.pago)} className={`p-2 rounded-lg ${despesa.pago ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}><CheckCircle className="w-5 h-5" /></button>
                                                <button onClick={() => deletarDespesa(despesa.id)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors"><Trash2 className="w-5 h-5" /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {abaAtiva === 'renda' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl shadow-xl p-6">
                            <h3 className="text-lg font-semibold mb-4">Adicionar Nova Renda</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <input type="text" placeholder="Descrição" value={novaRenda.descricao} onChange={(e) => setNovaRenda({...novaRenda, descricao: e.target.value})} className="md:col-span-2 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500" />
                                <input type="number" placeholder="Valor" value={novaRenda.valor} onChange={(e) => setNovaRenda({...novaRenda, valor: e.target.value})} className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500" />
                                <input type="date" value={novaRenda.data} onChange={(e) => setNovaRenda({...novaRenda, data: e.target.value})} className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500" />
                                <button onClick={adicionarRenda} className="md:col-start-4 bg-gradient-to-r from-green-500 to-teal-500 text-white px-6 py-3 rounded-xl font-medium hover:from-green-600 hover:to-teal-600 transition-all flex items-center justify-center space-x-2"><PlusCircle className="w-5 h-5" /><span>Adicionar</span></button>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl shadow-xl p-6">
                            <h3 className="text-lg font-semibold mb-4">Histórico de Renda</h3>
                            <div className="space-y-3">{rendas.map((renda) => (<div key={renda.id} className="flex items-center justify-between p-4 bg-green-50 rounded-xl"><div className="flex items-center space-x-4"><div className="bg-green-500 p-2 rounded-lg"><DollarSign className="w-5 h-5 text-white" /></div><div><p className="font-medium text-gray-800">{renda.descricao}</p><p className="text-sm text-gray-600">Recebido em: {formatarData(renda.data)}</p></div></div><div className="flex items-center gap-4"><p className="font-bold text-green-700">{formatarMoeda(renda.valor)}</p><button onClick={() => deletarRenda(renda.id)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors"><Trash2 className="w-5 h-5" /></button></div></div>))}</div>
                        </div>
                    </div>
                )}

                {abaAtiva === 'planejamento' && (
                    <div className="space-y-6">
                        <div className="text-center bg-white rounded-2xl shadow-xl p-6">
                            <h2 className="text-4xl font-bold text-rose-500">{planejamento.diasAteCasamento}</h2>
                            <p className="text-gray-600">dias até o grande dia!</p>
                        </div>
                        <div className="bg-white rounded-2xl shadow-xl p-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><AlertCircle className="text-red-500"/>Alertas e Pontos de Atenção</h3>
                            <div className="space-y-4">
                                {planejamento.alertas.length > 0 ? planejamento.alertas.map((item, index) => { const Icone = item.icone; return (<div key={index} className={`p-4 rounded-xl border-l-4 ${ item.tipo === 'error' ? 'bg-red-50 border-red-500' : item.tipo === 'warning' ? 'bg-yellow-50 border-yellow-500' : 'bg-blue-50 border-blue-500' }`}><div className="flex items-center space-x-3"><Icone className={`w-6 h-6 ${ item.tipo === 'error' ? 'text-red-600' : item.tipo === 'warning' ? 'text-yellow-600' : 'text-blue-600' }`} /><p className="text-gray-800">{item.texto}</p></div></div>);}) : <p className="text-gray-500">Tudo em ordem por aqui! Nenhum alerta crítico no momento.</p>}
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl shadow-xl p-6">
                             <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><ListChecks className="text-green-500"/>Checklist Inteligente</h3>
                            <div className="space-y-4">
                                {planejamento.sugestoes.map((item, index) => { const Icone = item.icone; return (<div key={index} className="p-4 rounded-xl bg-gray-50"><div className="flex items-start space-x-3"><Icone className="w-5 h-5 mt-1 text-gray-500" /><p className="text-gray-800">{item.texto}</p></div></div>);})}
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl shadow-xl p-6">
                             <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><PieChart className="text-purple-500"/>Análise de Gastos</h3>
                             <p className="text-sm text-gray-500 mb-4">Compare seus gastos com a média de mercado para identificar possíveis desvios.</p>
                            <div className="space-y-3">
                                {planejamento.analiseGastos.map((item) => (
                                    <div key={item.categoria} className="p-3 bg-gray-50 rounded-xl">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-medium">{item.categoria}</span>
                                            <div>
                                                <span className={`font-bold ${item.tipo === 'alto' ? 'text-red-500' : 'text-gray-800'}`}>{item.percentualReal}%</span>
                                                <span className="text-sm text-gray-500"> (média: {item.percentualMedio}%)</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div className="bg-purple-400 h-2.5 rounded-full" style={{width: `${item.percentualMedio}%`}}></div>
                                            <div className={`h-1 -mt-1.5 rounded-full ${item.tipo === 'alto' ? 'bg-red-500' : 'bg-green-500'}`} style={{width: `${item.percentualReal}%`}}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Componente Raiz que gerencia a autenticação ---
const App = () => {
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    const [storage, setStorage] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [configError, setConfigError] = useState(false);

    useEffect(() => {
        if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "SUA_API_KEY") {
            console.error("Configuração do Firebase não encontrada!");
            setConfigError(true);
            setLoading(false);
            return;
        }
        const app = initializeApp(firebaseConfig);
        setAuth(getAuth(app));
        setDb(getFirestore(app));
        setStorage(getStorage(app));
    }, []);

    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [auth]);

    const handleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Erro ao fazer login com Google:", error);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen bg-rose-50 text-rose-500">Carregando...</div>;
    }
    
    if (configError) {
         return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 text-red-700 p-4 text-center">
                <AlertCircle className="w-16 h-16 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Erro de Configuração</h1>
                <p className="max-w-md">A configuração do Firebase não foi adicionada. Por favor, edite o arquivo <strong>App.jsx</strong> e cole as credenciais do seu projeto Firebase para continuar.</p>
            </div>
        );
    }

    if (!user) {
        return <LoginPage onLogin={handleLogin} />;
    }

    if (!EMAILS_AUTORIZADOS.includes(user.email)) {
        console.warn(`Usuário não autorizado: ${user.email}`);
        return <AccessDeniedPage user={user} onLogout={handleLogout} />;
    }

    return <WeddingPlanner user={user} onLogout={handleLogout} db={db} storage={storage} />;
};

export default App;
