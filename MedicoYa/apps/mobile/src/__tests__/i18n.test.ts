import i18n from '../i18n'

describe('i18n translations', () => {
  afterEach(async () => {
    await i18n.changeLanguage('es')
  })

  it('loads Spanish auth keys', async () => {
    await i18n.changeLanguage('es')
    expect(i18n.t('auth.phone_label')).toBe('Número de teléfono')
    expect(i18n.t('auth.send_code')).toBe('Enviar código')
    expect(i18n.t('auth.code_label')).toBe('Código OTP')
    expect(i18n.t('auth.verify')).toBe('Verificar')
    expect(i18n.t('auth.change_phone')).toBe('← Cambiar teléfono')
    expect(i18n.t('auth.error_send')).toBe('Error al enviar código')
    expect(i18n.t('auth.error_verify')).toBe('Código inválido')
  })

  it('loads Spanish profile + common keys', async () => {
    await i18n.changeLanguage('es')
    expect(i18n.t('profile.title')).toBe('Perfil')
    expect(i18n.t('profile.language')).toBe('Idioma')
    expect(i18n.t('profile.logout')).toBe('Cerrar sesión')
    expect(i18n.t('common.coming_soon')).toBe('Próximamente')
    expect(i18n.t('common.error_generic')).toBe('Algo salió mal')
  })

  it('loads English keys', async () => {
    await i18n.changeLanguage('en')
    expect(i18n.t('auth.phone_label')).toBe('Phone number')
    expect(i18n.t('auth.send_code')).toBe('Send code')
    expect(i18n.t('auth.verify')).toBe('Verify')
    expect(i18n.t('profile.logout')).toBe('Sign out')
    expect(i18n.t('common.coming_soon')).toBe('Coming soon')
  })
})
