describe('Pruebas de API - Gestión de Vehículos', () => {
  const backendUrl = 'http://localhost:3000'; 

  it('GET /vehiculos/disponibles - Debería retornar el estado del parqueadero', () => {
    cy.request('GET', `${backendUrl}/parking-lots/1`)
      .then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('cuposDisponibles');
        expect(response.body.cuposDisponibles).to.be.a('number');
      });
  });
});