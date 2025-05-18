const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Configuração do cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
});
//defina  o horário de atendimento do bot
const businessHours = {
    mondayToThursday: { start: "08:00", end: "16:45" },
    friday: { start: "08:00", end: "15:45" },
};

// Função para verificar se estamos no horário de funcionamento
function isBusinessHours() {
    const now = new Date();
    const day = now.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
    const currentTime = now.toTimeString().slice(0, 5);

    if (day >= 1 && day <= 4) { // Segunda a quinta
        return currentTime >= businessHours.mondayToThursday.start && currentTime <= businessHours.mondayToThursday.end;
    } else if (day === 5) { // Sexta-feira
        return currentTime >= businessHours.friday.start && currentTime <= businessHours.friday.end;
    }
    return false;
}

// Gerenciar interações do cliente
const sessions = new Map();
//caso queira, defina um numero que nao ativara o bot e não receberá mensagens.
const blockedNumbers = ['@c.us']; // Substitua pelo número que deseja bloquear, sem espaços, com o código do país.


client.on('message', async (msg) => {
    if (msg.fromMe || msg.isGroupMsg) return; // Ignorar mensagens de grupos ou enviadas pelo bot

    const userId = msg.from;
    const now = new Date();
    const userSession = sessions.get(userId) || { lastInteraction: null, step: 0, name: null };

    // Verifica se o número está bloqueado
    if (blockedNumbers.includes(userId)) {
        console.log(`Mensagem ignorada do número bloqueado: ${userId}`);
        return; // Interrompe o processamento para este número
    }

    // Reinicia sessão inativa por mais de 1 hora
    if (userSession.lastInteraction && now - userSession.lastInteraction > 3600000) {
        sessions.delete(userId);
        userSession.step = 0;
        userSession.name = null;
    }
    userSession.lastInteraction = now;

    // Horário de funcionamento
    if (!isBusinessHours()) {
        await msg.reply("No momento, não estamos disponíveis. Assim que possível, entraremos em contato.");
        return;
    }

    switch (userSession.step) {
        case 0: // Saudação inicial
            const hour = now.getHours();
            const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
            await msg.reply(`${greeting}, tudo bem? Bem vindo(a) à Nossa Empresa. Antes de iniciarmos, por favor, digite seu nome:`);
            userSession.step = 1;
            break;

        case 1: // Recebe o nome do cliente
            if (/^[a-zA-Z\s]+$/.test(msg.body)) {
                userSession.name = msg.body.trim();
                await msg.reply(`Obrigado ${userSession.name}, é um prazer ter você aqui com a gente! Como podemos te ajudar hoje? Escolha a opção correspondente:\n\n1- Vendas\n2- Compras\n3- Financeiro\n4- Suporte Automação (Já sou cliente)\n5- Suporte Site\n6- Outros assuntos`);
                userSession.step = 2;
            } else {
                await msg.reply("O nome digitado está incorreto. Por favor, digite apenas seu nome (sem números ou caracteres especiais):");
            }
            break;

        case 2: // Recebe a opção do cliente
            const options = ["1", "2", "3", "4", "5", "6"];
            if (options.includes(msg.body)) {
                await msg.reply(`Por gentileza ${userSession.name}, descreva em poucas palavras o motivo do seu contato:`);
                userSession.step = 3;
            } else {
                await msg.reply("Por favor, escolha uma opção válida:\n1- Vendas\n2- Compras\n3- Financeiro\n4- Suporte (Já sou cliente)\n5- Outros assuntos");
            }
            break;

        case 3: // Recebe o motivo do contato
            await msg.reply(`Muito obrigado, ${userSession.name}. Em breve, um de nossos atendentes irá lhe responder.`);
            sessions.delete(userId); // Finaliza a sessão
            break;

        default:
            sessions.delete(userId); // Reinicia a sessão em caso de erro
            userSession.step = 0;
            break;
    }

    sessions.set(userId, userSession);
});

// Gera o QR Code no terminal
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log("Escaneie o QR Code acima para iniciar o bot.");
});

// Confirmação de conexão
client.on('ready', () => {
    console.log("WhatsApp bot está pronto!");
});

// Inicializa o cliente
client.initialize();
