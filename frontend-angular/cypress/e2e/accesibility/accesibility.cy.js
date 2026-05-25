describe('Pruebas de Accesibilidad (a11y) - Parkontrol', () => {
  it('La página de login no debería tener violaciones de accesibilidad', () => {
    cy.visit('http://localhost:4200/login');
    
    // Inyectamos el analizador de accesibilidad
    cy.injectAxe(); 
    
    // Escanea la página actual en busca de fallos (contraste de colores, etiquetas legibles, etc.)
    cy.checkA11y(); 
  });
});