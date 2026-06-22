import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';
import { Component } from '@angular/core';
import { routes } from './app-routing.module';

@Component({ selector: 'app-mock-root', template: '<router-outlet></router-outlet>' })
class MockAppComponent {}

@Component({ selector: 'app-mock-upload', template: '' })
class MockUploadComponent {}

@Component({ selector: 'app-mock-verification', template: '' })
class MockVerificationComponent {}

@Component({ selector: 'app-mock-list', template: '' })
class MockListComponent {}

describe('Routing Configuration', () => {
  let router: Router;
  let location: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes(routes)
      ],
      declarations: [
        MockAppComponent,
        MockUploadComponent,
        MockVerificationComponent,
        MockListComponent
      ]
    });

    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    router.initialNavigation();
  });

  it('should redirect empty route to /list', fakeAsync(() => {
    router.navigate(['']);
    tick();
    expect(location.path()).toBe('/list');
  }));

  it('should navigate to /upload', fakeAsync(() => {
    router.navigate(['/upload']);
    tick();
    expect(location.path()).toBe('/upload');
  }));

  it('should navigate to /verify', fakeAsync(() => {
    router.navigate(['/verify']);
    tick();
    expect(location.path()).toBe('/verify');
  }));

  it('should navigate to /list', fakeAsync(() => {
    router.navigate(['/list']);
    tick();
    expect(location.path()).toBe('/list');
  }));

  it('should redirect unknown wildcard path to /list', fakeAsync(() => {
    router.navigate(['/some-random-unknown-page']);
    tick();
    expect(location.path()).toBe('/list');
  }));
});
