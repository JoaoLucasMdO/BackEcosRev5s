// emailService.js
import nodemailer from 'nodemailer';

let transporter = null;

const initializeTransporter = async () => {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    await transporter.verify();
    console.log('Conexão com o servidor SMTP estabelecida com sucesso');
  } catch (error) {
    console.error('Erro ao conectar com o servidor SMTP:', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email, tempPassword) => {
  if (!transporter) {
    await initializeTransporter();
  }

const mailOptions = {
    from: `"Sistema de Recuperação" <${process.env.EMAIL_USER}>`, // Use seu email configurado
    to: email,
    subject: 'Recuperação de Senha',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">Recuperação de Senha</h2>
        <p>Olá,</p>
        <p>Recebemos uma solicitação para redefinir sua senha. Sua senha temporária é:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; font-size: 18px; margin: 20px 0; font-family: monospace;">
          <strong>${tempPassword}</strong>
        </div>
        <p>Use esta senha para fazer login. Você será redirecionado para uma tela onde poderá definir uma nova senha.</p>
        <p>Esta senha temporária é válida por 1 hora.</p>
        <p>Se você não solicitou esta redefinição, por favor ignore este email ou entre em contato com o suporte.</p>
        <p style="margin-top: 30px; color: #777; font-size: 12px; text-align: center;">
          Este é um email automático, por favor não responda.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email enviado com sucesso:', info.messageId);
    return info;
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    throw error;
  }
};
