import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { AuthService } from '../../services/auth.service';
import { AlertService } from '../../services/alert.service';
import { NavController } from '@ionic/angular';


@Component({
  selector: 'app-myaccount',
  templateUrl: './myaccount.page.html',
  styleUrls: ['./myaccount.page.scss'],
})

export class MyaccountPage implements OnInit {

  public accountForm: FormGroup;

  public submitAttempt: boolean = false;

  constructor(public formBuilder: FormBuilder,
    private authService: AuthService,
    private navCtrl: NavController,
    private alertService: AlertService) {
    this.accountForm = formBuilder.group({
      firstname: ['', Validators.compose([
        Validators.maxLength(30),
        Validators.minLength(2),
        Validators.pattern('[a-zA-Z ]*'),
        Validators.required
      ])],
      lastname: ['', Validators.compose([
        Validators.maxLength(30),
        Validators.minLength(2),
        Validators.pattern('[a-zA-Z ]*'),
        Validators.required
      ])],
      address: [''],
      notifications: ['']
    });
  }

  save() {
    this.submitAttempt = true;
    // Add code to connect to server
  }

  logout() {
    this.authService.logout().subscribe(
      data => {
        this.alertService.presentToast(data['message']);
      },
      error => {
        console.log(error);
      },
      () => {
        this.navCtrl.navigateRoot('/landing');
      }
    );
  }

  ngOnInit() {
  }

}
