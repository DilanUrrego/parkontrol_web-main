describe('template spec', () => {
  it('passes', () => {
        cy.visit('http://localhost:4200')
        cy.get('mat-form-field:nth-child(1) div.mat-mdc-text-field-wrapper').click();
        cy.get('#mat-input-0').type('d@ex.com');
        cy.get('mat-form-field.mat-form-field-hide-placeholder div.mat-mdc-text-field-wrapper').click();
        cy.get('#mat-input-1').type('123456');
        cy.get('span.mdc-button__label span').click();
        cy.get('a[href="/celdas"]').click();
        cy.get('th.mat-column-id.mat-mdc-header-cell').click();
  })
})