describe('Pruebas de Seguridad - Control de Accesos', () => {
  it('Debería denegar el acceso al panel de control si no se ha iniciado sesión', () => {
    // Intentamos entrar directo a la sección de administración del parqueadero
    cy.visit('http://localhost:4200/dashboard/admin');
    
    // El sistema debe interceptar la petición y rebotar al usuario al Login
    cy.url().should('include', '/login');
  });
});